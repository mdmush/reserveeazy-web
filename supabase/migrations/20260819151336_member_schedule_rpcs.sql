-- Member portal M-C: read RPCs for the portal. Members have no direct SELECT
-- on class_sessions or business_members (teacher emails and other members'
-- seats would leak) — these SECURITY DEFINER functions return exactly what
-- the portal needs: teacher display names, seats-taken counts, and only the
-- caller's own (and dependents') booking rows.

CREATE OR REPLACE FUNCTION get_member_schedule(
  p_business_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_business_admin(p_business_id) AND NOT EXISTS (
    SELECT 1 FROM clients
     WHERE business_id = p_business_id
       AND id IN (SELECT get_member_client_ids())
  ) THEN
    RAISE EXCEPTION 'Not a member of this studio';
  END IF;
  IF p_to <= p_from OR p_to - p_from > interval '60 days' THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', cs.id,
      'class_type_id', cs.class_type_id,
      'type_name', ct.name,
      'credit_cost', ct.credit_cost,
      'drop_in_price_cents', ct.drop_in_price_cents,
      'start_at', cs.start_at,
      'end_at', cs.end_at,
      'room', cs.room,
      'capacity', cs.capacity,
      'teacher_name', bm.display_name,
      'seats_taken', _seats_taken(cs.id),
      'my_bookings', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'booking_id', b.id,
          'client_id', b.client_id,
          'status', b.status,
          'waitlist_position', b.waitlist_position,
          'offer_expires_at', b.offer_expires_at
        ))
        FROM bookings b
        WHERE b.class_session_id = cs.id
          AND b.client_id IN (SELECT get_member_client_ids())
          AND b.status IN ('booked','pass_makeup','waitlisted','offered')
      ), '[]'::jsonb)
    ) ORDER BY cs.start_at)
    FROM class_sessions cs
    JOIN class_types ct ON ct.id = cs.class_type_id
    JOIN business_members bm ON bm.id = cs.teacher_id
    WHERE cs.business_id = p_business_id
      AND cs.status = 'scheduled'
      AND cs.start_at >= p_from
      AND cs.start_at < p_to
  ), '[]'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION get_member_schedule(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_member_schedule(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION get_member_bookings(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_business_admin(p_business_id) AND NOT EXISTS (
    SELECT 1 FROM clients
     WHERE business_id = p_business_id
       AND id IN (SELECT get_member_client_ids())
  ) THEN
    RAISE EXCEPTION 'Not a member of this studio';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_data ORDER BY start_at DESC)
    FROM (
      SELECT cs.start_at,
             jsonb_build_object(
               'booking_id', b.id,
               'client_id', b.client_id,
               'client_name', c.full_name,
               'status', b.status,
               'credit_cost_snapshot', b.credit_cost_snapshot,
               'grace_pass_id', b.grace_pass_id,
               'waitlist_position', b.waitlist_position,
               'offer_expires_at', b.offer_expires_at,
               'session_id', cs.id,
               'type_name', ct.name,
               'start_at', cs.start_at,
               'end_at', cs.end_at,
               'room', cs.room,
               'teacher_name', bm.display_name
             ) AS row_data
      FROM bookings b
      JOIN clients c ON c.id = b.client_id
      JOIN class_sessions cs ON cs.id = b.class_session_id
      JOIN class_types ct ON ct.id = cs.class_type_id
      JOIN business_members bm ON bm.id = cs.teacher_id
      WHERE b.business_id = p_business_id
        AND b.client_id IN (SELECT get_member_client_ids())
      ORDER BY cs.start_at DESC
      LIMIT 200
    ) rows
  ), '[]'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION get_member_bookings(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_member_bookings(UUID) TO authenticated;
