-- Membership build: waitlist claim-window flow (spec §6.7).
-- Members are never auto-booked: a freed seat is OFFERED (reserving the
-- seat) and the admin confirms the claim after the member replies on
-- WhatsApp. Expired offers are released back to the queue by the admin.

CREATE OR REPLACE FUNCTION offer_waitlist_spot(p_booking_id UUID)
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
  v_window_end TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF NOT is_business_admin(v_booking.business_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF v_booking.status <> 'waitlisted' THEN
    RAISE EXCEPTION 'Only waitlisted members can be offered a spot';
  END IF;

  SELECT * INTO v_session FROM class_sessions
   WHERE id = v_booking.class_session_id FOR UPDATE;
  IF v_session.status <> 'scheduled' OR v_session.start_at <= now() THEN
    RAISE EXCEPTION 'This session is no longer offerable';
  END IF;
  IF _seats_taken(v_session.id) >= v_session.capacity THEN
    RAISE EXCEPTION 'No free seat to offer';
  END IF;

  SELECT COALESCE((b.settings->>'cancellation_cutoff_hours')::int, 24),
         COALESCE((b.settings->>'waitlist_claim_window_minutes')::int, 120)
    INTO v_cutoff_hours, v_claim_minutes
    FROM businesses b WHERE b.id = v_booking.business_id;

  -- Claim window, shrunk so it never crosses the cancellation cutoff.
  v_window_end := least(
    now() + make_interval(mins => v_claim_minutes),
    v_session.start_at - make_interval(hours => v_cutoff_hours)
  );
  -- Inside the cutoff there is no meaningful window left; offer to class start.
  IF v_window_end <= now() THEN
    v_window_end := least(now() + make_interval(mins => v_claim_minutes), v_session.start_at);
  END IF;

  UPDATE bookings
     SET status = 'offered', offered_at = now(), offer_expires_at = v_window_end
   WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'client_id', v_booking.client_id,
    'offer_expires_at', v_window_end
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION offer_waitlist_spot(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION offer_waitlist_spot(UUID) TO authenticated;

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
  IF NOT is_business_admin(v_booking.business_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF v_booking.status <> 'offered' THEN
    RAISE EXCEPTION 'This member has no active offer';
  END IF;
  IF v_booking.offer_expires_at IS NOT NULL AND v_booking.offer_expires_at <= now() THEN
    RAISE EXCEPTION 'The claim window has expired — re-offer or release the spot';
  END IF;

  SELECT * INTO v_session FROM class_sessions
   WHERE id = v_booking.class_session_id FOR UPDATE;

  -- The offer held the seat; fund and confirm. Insufficient credits raise
  -- and the booking stays offered for the admin to resolve.
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
REVOKE EXECUTE ON FUNCTION claim_waitlist_offer(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION claim_waitlist_offer(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION release_waitlist_offer(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_position INT;
  v_next bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF NOT is_business_admin(v_booking.business_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF v_booking.status <> 'offered' THEN
    RAISE EXCEPTION 'This member has no active offer';
  END IF;

  -- Back of the queue; the freed seat can be offered to the next member.
  SELECT COALESCE(max(waitlist_position), 0) + 1 INTO v_position
    FROM bookings
   WHERE class_session_id = v_booking.class_session_id AND status = 'waitlisted';

  UPDATE bookings
     SET status = 'waitlisted', waitlist_position = v_position,
         offered_at = NULL, offer_expires_at = NULL
   WHERE id = p_booking_id;

  SELECT * INTO v_next FROM bookings
   WHERE class_session_id = v_booking.class_session_id AND status = 'waitlisted'
     AND id <> p_booking_id
   ORDER BY waitlist_position ASC
   LIMIT 1;

  RETURN jsonb_build_object(
    'released_booking_id', p_booking_id,
    'next_candidate_booking_id', v_next.id
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION release_waitlist_offer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION release_waitlist_offer(UUID) TO authenticated;
