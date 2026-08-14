-- Membership build M5: grace / replacement passes (spec §6.5, P0-9).
-- Admin discretion with a mandatory reason note; a pass lets a member attend
-- a DIFFERENT class type as a make-up. It consumes the originally missed
-- credit and never creates new credits. No hard cap — the pass log surfaces
-- abuse patterns instead.

CREATE TABLE grace_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  source_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'redeemed', 'revoked')),
  redeemed_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX grace_passes_business_client_idx ON grace_passes (business_id, client_id);

ALTER TABLE grace_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY grace_passes_select_member ON grace_passes
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY grace_passes_select_superuser ON grace_passes
  FOR SELECT TO authenticated USING (is_superuser());
-- Writes only via RPCs.

ALTER TABLE bookings
  ADD CONSTRAINT bookings_grace_pass_fk
  FOREIGN KEY (grace_pass_id) REFERENCES grace_passes(id) ON DELETE SET NULL;

-- grant / revoke -----------------------------------------------------------
CREATE OR REPLACE FUNCTION grant_grace_pass(
  p_client_id UUID,
  p_reason TEXT,
  p_source_booking_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client clients%ROWTYPE;
  v_source bookings%ROWTYPE;
  v_pass_id UUID;
BEGIN
  SELECT * INTO v_client FROM clients WHERE id = p_client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF NOT is_business_admin(v_client.business_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required to grant a pass';
  END IF;

  IF p_source_booking_id IS NOT NULL THEN
    SELECT * INTO v_source FROM bookings WHERE id = p_source_booking_id;
    IF NOT FOUND OR v_source.client_id <> p_client_id THEN
      RAISE EXCEPTION 'Source booking does not belong to this member';
    END IF;
    IF v_source.status NOT IN ('no_show', 'cancelled_late') THEN
      RAISE EXCEPTION 'Passes replace missed classes (no-show or late cancel)';
    END IF;
    PERFORM 1 FROM grace_passes
     WHERE source_booking_id = p_source_booking_id AND status <> 'revoked';
    IF FOUND THEN
      RAISE EXCEPTION 'A pass was already granted for this missed class';
    END IF;
  END IF;

  INSERT INTO grace_passes (business_id, client_id, source_booking_id, reason, granted_by)
  VALUES (v_client.business_id, p_client_id, p_source_booking_id, p_reason, auth.uid())
  RETURNING id INTO v_pass_id;

  INSERT INTO credit_transactions (
    business_id, client_id, booking_id, kind, amount, reason, actor_user_id
  ) VALUES (
    v_client.business_id, p_client_id, p_source_booking_id,
    'pass_grant', 0, p_reason, auth.uid()
  );

  RETURN v_pass_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION grant_grace_pass(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION grant_grace_pass(UUID, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION revoke_grace_pass(p_pass_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pass grace_passes%ROWTYPE;
BEGIN
  SELECT * INTO v_pass FROM grace_passes WHERE id = p_pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pass not found'; END IF;
  IF NOT is_business_admin(v_pass.business_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF v_pass.status <> 'available' THEN
    RAISE EXCEPTION 'Only available passes can be revoked';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required to revoke a pass';
  END IF;

  UPDATE grace_passes SET status = 'revoked' WHERE id = p_pass_id;
  INSERT INTO credit_transactions (
    business_id, client_id, kind, amount, reason, actor_user_id
  ) VALUES (
    v_pass.business_id, v_pass.client_id,
    'manual_adjustment', 0, 'Pass revoked: ' || p_reason, auth.uid()
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION revoke_grace_pass(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION revoke_grace_pass(UUID, TEXT) TO authenticated;

-- Redefine book_class with the pass path live -------------------------------
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
      -- A make-up is for a DIFFERENT class type than the missed one (§6.5).
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
