-- Membership build M3: bookings + the transactional engine RPCs.
-- Seat changes serialize on SELECT ... FOR UPDATE of the class_sessions row.
-- Cost rule: locked package pays 1 credit/class; flexible pays the class
-- type's credit_cost. Deduction order: locked-first, then soonest expiry,
-- then oldest purchase. Refunds always return to the source instance.

CREATE TYPE booking_status AS ENUM (
  'booked', 'waitlisted', 'offered',
  'cancelled_early', 'cancelled_late',
  'attended', 'no_show', 'pass_makeup'
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  class_session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  status booking_status NOT NULL,
  paid_by_package_instance_id UUID REFERENCES package_instances(id) ON DELETE RESTRICT,
  credit_cost_snapshot INT,
  grace_pass_id UUID,  -- FK completed in the grace_passes migration
  waitlist_position INT,
  offered_at TIMESTAMPTZ,
  offer_expires_at TIMESTAMPTZ,
  booked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One live booking per client per session (cancelled rows don't block rebooking).
CREATE UNIQUE INDEX bookings_live_unique
  ON bookings (class_session_id, client_id)
  WHERE status IN ('booked','waitlisted','offered','attended','no_show','pass_makeup');
CREATE INDEX bookings_business_client_idx ON bookings (business_id, client_id);
CREATE INDEX bookings_session_status_idx ON bookings (class_session_id, status);
CREATE INDEX bookings_session_waitlist_idx ON bookings (class_session_id, waitlist_position)
  WHERE status = 'waitlisted';

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bookings_select_member ON bookings
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY bookings_select_superuser ON bookings
  FOR SELECT TO authenticated USING (is_superuser());
-- No write policies: every transition happens inside the RPCs below.

ALTER TABLE credit_transactions
  ADD CONSTRAINT credit_transactions_booking_fk
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;

-- Seat-holding statuses count toward capacity; an offer reserves the seat
-- for the claim window.
CREATE OR REPLACE FUNCTION _seats_taken(p_session_id UUID)
RETURNS INT
LANGUAGE sql
AS $$
  SELECT count(*)::int FROM bookings
   WHERE class_session_id = p_session_id
     AND status IN ('booked','pass_makeup','attended','no_show','offered');
$$;
REVOKE EXECUTE ON FUNCTION _seats_taken(UUID) FROM PUBLIC, anon, authenticated;

-- Single deduction path used by book_class and (later) claim_waitlist_offer.
-- Assumes the session row is already locked by the caller.
CREATE OR REPLACE FUNCTION _fund_booking(
  p_booking_id UUID,
  p_client_id UUID,
  p_session class_sessions,
  p_override_instance_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_class_type class_types%ROWTYPE;
  v_instance package_instances%ROWTYPE;
  v_cost INT;
  v_balance INT;
BEGIN
  SELECT * INTO v_class_type FROM class_types WHERE id = p_session.class_type_id;

  FOR v_instance IN
    SELECT pi.* FROM package_instances pi
     WHERE pi.client_id = p_client_id
       AND pi.business_id = p_session.business_id
       AND (p_override_instance_id IS NULL OR pi.id = p_override_instance_id)
       AND (pi.scope = 'flexible' OR pi.class_type_id = p_session.class_type_id)
       AND (pi.expires_at IS NULL OR pi.expires_at > now())
     ORDER BY (pi.scope = 'locked') DESC,
              pi.expires_at ASC NULLS LAST,
              pi.purchased_at ASC
     FOR UPDATE
  LOOP
    v_cost := CASE WHEN v_instance.scope = 'locked' THEN 1
                   ELSE v_class_type.credit_cost END;

    SELECT COALESCE(sum(amount), 0) INTO v_balance
      FROM credit_transactions
     WHERE package_instance_id = v_instance.id;

    IF v_balance >= v_cost THEN
      INSERT INTO credit_transactions (
        business_id, client_id, package_instance_id, booking_id,
        kind, amount, cost_snapshot, actor_user_id
      ) VALUES (
        p_session.business_id, p_client_id, v_instance.id, p_booking_id,
        'deduction', -v_cost, v_cost, auth.uid()
      );

      UPDATE bookings
         SET paid_by_package_instance_id = v_instance.id,
             credit_cost_snapshot = v_cost
       WHERE id = p_booking_id;

      RETURN jsonb_build_object(
        'package_instance_id', v_instance.id,
        'credit_cost', v_cost
      );
    END IF;
  END LOOP;

  RAISE EXCEPTION 'No eligible package with sufficient credits';
END;
$$;
REVOKE EXECUTE ON FUNCTION _fund_booking(UUID, UUID, class_sessions, UUID) FROM PUBLIC, anon, authenticated;

-- Activation shared by attendance and the anti-parking rule (§6.2): the
-- validity clock starts once, on first attendance OR the first late-cancel /
-- no-show of an unactivated first-attendance package.
CREATE OR REPLACE FUNCTION _activate_instance(
  p_instance_id UUID,
  p_activated_at TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ  -- new expiry, or NULL if nothing changed
LANGUAGE plpgsql
AS $$
DECLARE
  v_instance package_instances%ROWTYPE;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_instance FROM package_instances
   WHERE id = p_instance_id FOR UPDATE;
  IF NOT FOUND
     OR v_instance.activated_at IS NOT NULL
     OR v_instance.expiry_trigger <> 'first_attendance' THEN
    RETURN NULL;
  END IF;

  v_expires := p_activated_at + make_interval(days => v_instance.validity_days);
  UPDATE package_instances
     SET activated_at = p_activated_at, expires_at = v_expires
   WHERE id = p_instance_id;
  RETURN v_expires;
END;
$$;
REVOKE EXECUTE ON FUNCTION _activate_instance(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

-- book_class ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION book_class(
  p_class_session_id UUID,
  p_client_id UUID,
  p_package_instance_id UUID DEFAULT NULL,
  p_grace_pass_id UUID DEFAULT NULL,
  p_join_waitlist BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session class_sessions%ROWTYPE;
  v_client clients%ROWTYPE;
  v_waiver_version_id UUID;
  v_booking_id UUID;
  v_funding JSONB;
  v_position INT;
  v_overlap INT;
BEGIN
  SELECT * INTO v_session FROM class_sessions
   WHERE id = p_class_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Class session not found'; END IF;
  IF NOT is_business_admin(v_session.business_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF v_session.status <> 'scheduled' THEN
    RAISE EXCEPTION 'This session is cancelled';
  END IF;
  IF v_session.start_at <= now() THEN
    RAISE EXCEPTION 'This session has already started';
  END IF;

  SELECT * INTO v_client FROM clients
   WHERE id = p_client_id AND business_id = v_session.business_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  -- Waiver gate (active once the business publishes a waiver version; the
  -- waiver tables land in a later migration, so probe for their existence).
  IF to_regclass('public.waiver_versions') IS NOT NULL THEN
    EXECUTE
      'SELECT wv.id FROM waiver_versions wv
        WHERE wv.business_id = $1 AND wv.published_at IS NOT NULL
        ORDER BY wv.version DESC LIMIT 1'
      INTO v_waiver_version_id USING v_session.business_id;
    IF v_waiver_version_id IS NOT NULL THEN
      PERFORM 1 FROM waiver_acceptances wa
        WHERE wa.client_id = p_client_id
          AND wa.waiver_version_id = v_waiver_version_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Member has not accepted the current waiver';
      END IF;
    END IF;
  END IF;

  -- No duplicate live booking (unique index backstops this).
  PERFORM 1 FROM bookings
   WHERE class_session_id = p_class_session_id AND client_id = p_client_id
     AND status IN ('booked','waitlisted','offered','attended','no_show','pass_makeup');
  IF FOUND THEN RAISE EXCEPTION 'Member is already on this session'; END IF;

  -- Member cannot hold overlapping bookings (spec §10 conflict rules).
  SELECT count(*) INTO v_overlap
    FROM bookings b
    JOIN class_sessions cs ON cs.id = b.class_session_id
   WHERE b.client_id = p_client_id
     AND b.status IN ('booked','pass_makeup','offered','waitlisted')
     AND cs.status = 'scheduled'
     AND tstzrange(cs.start_at, cs.end_at, '[)') &&
         tstzrange(v_session.start_at, v_session.end_at, '[)');
  IF v_overlap > 0 THEN
    RAISE EXCEPTION 'Member already has a booking at this time';
  END IF;

  IF _seats_taken(p_class_session_id) < v_session.capacity THEN
    IF p_grace_pass_id IS NOT NULL THEN
      -- The grace_passes migration redefines book_class with the pass path.
      RAISE EXCEPTION 'Grace passes are not available yet';
    END IF;

    INSERT INTO bookings (business_id, class_session_id, client_id, status, booked_by)
    VALUES (v_session.business_id, p_class_session_id, p_client_id, 'booked', auth.uid())
    RETURNING id INTO v_booking_id;

    v_funding := _fund_booking(v_booking_id, p_client_id, v_session, p_package_instance_id);

    RETURN jsonb_build_object(
      'booking_id', v_booking_id,
      'status', 'booked',
      'package_instance_id', v_funding->>'package_instance_id',
      'credit_cost', v_funding->'credit_cost'
    );
  END IF;

  -- Session full → waitlist (no deduction until a spot is claimed).
  IF NOT p_join_waitlist THEN
    RAISE EXCEPTION 'Class is full';
  END IF;

  SELECT COALESCE(max(waitlist_position), 0) + 1 INTO v_position
    FROM bookings
   WHERE class_session_id = p_class_session_id AND status = 'waitlisted';

  INSERT INTO bookings (
    business_id, class_session_id, client_id, status, waitlist_position, booked_by
  ) VALUES (
    v_session.business_id, p_class_session_id, p_client_id, 'waitlisted', v_position, auth.uid()
  ) RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object(
    'booking_id', v_booking_id,
    'status', 'waitlisted',
    'waitlist_position', v_position
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION book_class(UUID, UUID, UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION book_class(UUID, UUID, UUID, UUID, BOOLEAN) TO authenticated;

-- cancel_booking -----------------------------------------------------------
CREATE OR REPLACE FUNCTION cancel_booking(
  p_booking_id UUID,
  p_force_refund BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_session class_sessions%ROWTYPE;
  v_cutoff_hours INT;
  v_claim_minutes INT;
  v_is_early BOOLEAN;
  v_activated TIMESTAMPTZ;
  v_next bookings%ROWTYPE;
  v_window_end TIMESTAMPTZ;
  v_outcome TEXT;
  v_offer JSONB := NULL;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF NOT is_business_admin(v_booking.business_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_session FROM class_sessions
   WHERE id = v_booking.class_session_id FOR UPDATE;

  SELECT COALESCE((b.settings->>'cancellation_cutoff_hours')::int, 24),
         COALESCE((b.settings->>'waitlist_claim_window_minutes')::int, 120)
    INTO v_cutoff_hours, v_claim_minutes
    FROM businesses b WHERE b.id = v_booking.business_id;

  IF v_booking.status IN ('waitlisted', 'offered') THEN
    UPDATE bookings
       SET status = 'cancelled_early', waitlist_position = NULL,
           offered_at = NULL, offer_expires_at = NULL
     WHERE id = p_booking_id;
    RETURN jsonb_build_object('outcome', 'removed_from_waitlist');
  END IF;

  IF v_booking.status NOT IN ('booked', 'pass_makeup') THEN
    RAISE EXCEPTION 'Only upcoming bookings can be cancelled (status: %)', v_booking.status;
  END IF;

  v_is_early := p_force_refund
    OR (v_session.start_at - now()) >= make_interval(hours => v_cutoff_hours);

  IF v_is_early THEN
    UPDATE bookings SET status = 'cancelled_early' WHERE id = p_booking_id;
    IF v_booking.status = 'pass_makeup' THEN
      -- Pass returns to available (completed in the grace_passes migration).
      IF v_booking.grace_pass_id IS NOT NULL
         AND to_regclass('public.grace_passes') IS NOT NULL THEN
        EXECUTE 'UPDATE grace_passes SET status = ''available'', redeemed_booking_id = NULL WHERE id = $1'
          USING v_booking.grace_pass_id;
        INSERT INTO credit_transactions (
          business_id, client_id, package_instance_id, booking_id,
          kind, amount, reason, actor_user_id
        ) VALUES (
          v_booking.business_id, v_booking.client_id, NULL, p_booking_id,
          'pass_redemption', 0, 'Pass returned: early cancellation', auth.uid()
        );
      END IF;
    ELSIF v_booking.paid_by_package_instance_id IS NOT NULL THEN
      -- Refund to the source package (§6.4).
      INSERT INTO credit_transactions (
        business_id, client_id, package_instance_id, booking_id,
        kind, amount, cost_snapshot, actor_user_id, reason
      ) VALUES (
        v_booking.business_id, v_booking.client_id,
        v_booking.paid_by_package_instance_id, p_booking_id,
        'refund', v_booking.credit_cost_snapshot, v_booking.credit_cost_snapshot,
        auth.uid(), CASE WHEN p_force_refund THEN 'Policy override refund' END
      );
    END IF;
    v_outcome := 'refunded';
  ELSE
    UPDATE bookings SET status = 'cancelled_late' WHERE id = p_booking_id;
    INSERT INTO credit_transactions (
      business_id, client_id, package_instance_id, booking_id,
      kind, amount, actor_user_id, reason
    ) VALUES (
      v_booking.business_id, v_booking.client_id,
      v_booking.paid_by_package_instance_id, p_booking_id,
      'forfeit', 0, auth.uid(), 'Late cancellation (<' || v_cutoff_hours || 'h)'
    );
    -- Anti-parking (§6.2): a late cancel of an unactivated package starts it.
    IF v_booking.paid_by_package_instance_id IS NOT NULL THEN
      v_activated := _activate_instance(v_booking.paid_by_package_instance_id, now());
    END IF;
    v_outcome := 'forfeited';
  END IF;

  -- A seat freed → offer it to the head of the waitlist (never auto-book).
  SELECT * INTO v_next FROM bookings
   WHERE class_session_id = v_session.id AND status = 'waitlisted'
   ORDER BY waitlist_position ASC
   LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    v_window_end := least(
      now() + make_interval(mins => v_claim_minutes),
      v_session.start_at - make_interval(hours => v_cutoff_hours)
    );
    IF v_window_end > now() THEN
      UPDATE bookings
         SET status = 'offered', offered_at = now(), offer_expires_at = v_window_end
       WHERE id = v_next.id;
      v_offer := jsonb_build_object(
        'booking_id', v_next.id,
        'client_id', v_next.client_id,
        'offer_expires_at', v_window_end
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'outcome', v_outcome,
    'activated_expiry', v_activated,
    'offer', v_offer
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION cancel_booking(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cancel_booking(UUID, BOOLEAN) TO authenticated;
