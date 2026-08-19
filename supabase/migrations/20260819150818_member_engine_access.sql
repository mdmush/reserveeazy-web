-- Member portal M-B: open the booking engine to members without moving any
-- invariants. Guards switch from admin-only to _can_act_for_client (admin OR
-- the member themself OR their guardian); everything else in each body is
-- unchanged. Also fixes the latent mode-B bug: _fund_booking demanded credit
-- packages even in pay_per_class studios, where dues (created at attendance)
-- are the payment record — bookings there now carry null funding.
-- Admin-only RPCs are untouched: offer/release_waitlist_spot, mark/revert
-- attendance, grant/revoke passes, assign_package, adjust_credits,
-- record_due_payment, waive_due.

-- _fund_booking: mode-B branch -----------------------------------------------
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
  v_mode TEXT;
  v_class_type class_types%ROWTYPE;
  v_instance package_instances%ROWTYPE;
  v_cost INT;
  v_balance INT;
BEGIN
  SELECT pricing_mode INTO v_mode FROM businesses WHERE id = p_session.business_id;
  IF v_mode = 'pay_per_class' THEN
    -- No credits in mode B: attendance creates the payment-due line.
    RETURN jsonb_build_object('package_instance_id', NULL, 'credit_cost', NULL);
  END IF;

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

-- book_class: guard relaxed to _can_act_for_client ---------------------------
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
  v_pass grace_passes%ROWTYPE;
  v_missed_class_type UUID;
  v_waiver_version_id UUID;
  v_booking_id UUID;
  v_funding JSONB;
  v_position INT;
  v_overlap INT;
BEGIN
  SELECT * INTO v_session FROM class_sessions
   WHERE id = p_class_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Class session not found'; END IF;
  IF v_session.status <> 'scheduled' THEN
    RAISE EXCEPTION 'This session is cancelled';
  END IF;
  IF v_session.start_at <= now() THEN
    RAISE EXCEPTION 'This session has already started';
  END IF;

  SELECT * INTO v_client FROM clients
   WHERE id = p_client_id AND business_id = v_session.business_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  IF NOT _can_act_for_client(p_client_id) THEN
    RAISE EXCEPTION 'Not allowed to book for this member';
  END IF;

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

  PERFORM 1 FROM bookings
   WHERE class_session_id = p_class_session_id AND client_id = p_client_id
     AND status IN ('booked','waitlisted','offered','attended','no_show','pass_makeup');
  IF FOUND THEN RAISE EXCEPTION 'Member is already on this session'; END IF;

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
      SELECT * INTO v_pass FROM grace_passes
       WHERE id = p_grace_pass_id FOR UPDATE;
      IF NOT FOUND OR v_pass.business_id <> v_session.business_id THEN
        RAISE EXCEPTION 'Grace pass not found';
      END IF;
      IF v_pass.client_id <> p_client_id THEN
        RAISE EXCEPTION 'This pass belongs to another member';
      END IF;
      IF v_pass.status <> 'available' THEN
        RAISE EXCEPTION 'This pass is already %', v_pass.status;
      END IF;
      IF v_pass.source_booking_id IS NOT NULL THEN
        SELECT cs.class_type_id INTO v_missed_class_type
          FROM bookings b JOIN class_sessions cs ON cs.id = b.class_session_id
         WHERE b.id = v_pass.source_booking_id;
        IF v_missed_class_type = v_session.class_type_id THEN
          RAISE EXCEPTION 'A make-up pass must be used for a different class type';
        END IF;
      END IF;

      INSERT INTO bookings (
        business_id, class_session_id, client_id, status, grace_pass_id, booked_by
      ) VALUES (
        v_session.business_id, p_class_session_id, p_client_id,
        'pass_makeup', p_grace_pass_id, auth.uid()
      ) RETURNING id INTO v_booking_id;

      UPDATE grace_passes
         SET status = 'redeemed', redeemed_booking_id = v_booking_id
       WHERE id = p_grace_pass_id;

      INSERT INTO credit_transactions (
        business_id, client_id, booking_id, kind, amount, reason, actor_user_id
      ) VALUES (
        v_session.business_id, p_client_id, v_booking_id,
        'pass_redemption', 0, 'Make-up pass redeemed', auth.uid()
      );

      RETURN jsonb_build_object('booking_id', v_booking_id, 'status', 'pass_makeup');
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

-- cancel_booking: member-cancellable; force refund stays admin-only ----------
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
  IF NOT _can_act_for_client(v_booking.client_id) THEN
    RAISE EXCEPTION 'Not allowed to cancel this booking';
  END IF;
  IF p_force_refund AND NOT is_business_admin(v_booking.business_id) THEN
    RAISE EXCEPTION 'Admin access required for a policy override refund';
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
    IF v_booking.paid_by_package_instance_id IS NOT NULL THEN
      v_activated := _activate_instance(v_booking.paid_by_package_instance_id, now());
    END IF;
    v_outcome := 'forfeited';
  END IF;

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

-- claim_waitlist_offer: members claim their own/dependents' offers -----------
CREATE OR REPLACE FUNCTION claim_waitlist_offer(
  p_booking_id UUID,
  p_package_instance_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_session class_sessions%ROWTYPE;
  v_funding JSONB;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF NOT _can_act_for_client(v_booking.client_id) THEN
    RAISE EXCEPTION 'Not allowed to claim this offer';
  END IF;
  IF v_booking.status <> 'offered' THEN
    RAISE EXCEPTION 'This member has no active offer';
  END IF;
  IF v_booking.offer_expires_at IS NOT NULL AND v_booking.offer_expires_at <= now() THEN
    RAISE EXCEPTION 'The claim window has expired — re-offer or release the spot';
  END IF;

  SELECT * INTO v_session FROM class_sessions
   WHERE id = v_booking.class_session_id FOR UPDATE;

  v_funding := _fund_booking(
    p_booking_id, v_booking.client_id, v_session, p_package_instance_id
  );

  UPDATE bookings
     SET status = 'booked', waitlist_position = NULL,
         offered_at = NULL, offer_expires_at = NULL
   WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'status', 'booked',
    'package_instance_id', v_funding->>'package_instance_id',
    'credit_cost', v_funding->'credit_cost'
  );
END;
$$;

-- record_waiver_acceptance: members sign for themselves; guardians for
-- dependents. Guardian rules unchanged.
CREATE OR REPLACE FUNCTION record_waiver_acceptance(
  p_client_id UUID,
  p_signature_name TEXT,
  p_accepted_by_client_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client clients%ROWTYPE;
  v_version_id UUID;
  v_acceptance_id UUID;
BEGIN
  SELECT * INTO v_client FROM clients WHERE id = p_client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF NOT _can_act_for_client(p_client_id) THEN
    RAISE EXCEPTION 'Not allowed to sign for this member';
  END IF;
  IF p_signature_name IS NULL OR length(trim(p_signature_name)) = 0 THEN
    RAISE EXCEPTION 'The signing name is required';
  END IF;

  SELECT wv.id INTO v_version_id FROM waiver_versions wv
   WHERE wv.business_id = v_client.business_id AND wv.published_at IS NOT NULL
   ORDER BY wv.version DESC LIMIT 1;
  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'No published waiver version to accept';
  END IF;

  IF p_accepted_by_client_id IS NOT NULL THEN
    IF v_client.guardian_client_id IS DISTINCT FROM p_accepted_by_client_id THEN
      RAISE EXCEPTION 'Only the linked guardian can accept for a dependent';
    END IF;
  ELSIF v_client.guardian_client_id IS NOT NULL THEN
    RAISE EXCEPTION 'Dependents need their guardian to accept the waiver';
  END IF;

  INSERT INTO waiver_acceptances (
    business_id, client_id, waiver_version_id,
    accepted_by_client_id, signature_name, recorded_by
  ) VALUES (
    v_client.business_id, p_client_id, v_version_id,
    p_accepted_by_client_id, p_signature_name, auth.uid()
  )
  ON CONFLICT (client_id, waiver_version_id) DO NOTHING
  RETURNING id INTO v_acceptance_id;

  IF v_acceptance_id IS NULL THEN
    RAISE EXCEPTION 'This member already accepted the current waiver';
  END IF;

  RETURN v_acceptance_id;
END;
$$;
