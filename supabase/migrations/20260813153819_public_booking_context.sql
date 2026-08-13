-- Single public entry point for the /book/[slug] and embed booking pages.
-- Replaces direct anon table reads (the USING (true) policies dropped in the
-- next migration) with one SECURITY DEFINER function that returns exactly what
-- the booking page needs and nothing more — no client PII, no staff emails.
-- Also fixes a real bug: the loader previously selected appointments as anon,
-- which RLS silently returned empty, so busy slots were not excluded and
-- double-books were only caught at write time by create_public_booking.

CREATE OR REPLACE FUNCTION get_public_booking_context(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business businesses%ROWTYPE;
  result JSONB;
BEGIN
  SELECT * INTO v_business FROM businesses WHERE slug = p_slug;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business.id,
      'name', v_business.name,
      'slug', v_business.slug,
      'business_type', v_business.business_type,
      'timezone', v_business.timezone,
      'settings', v_business.settings,
      'pricing_mode', v_business.pricing_mode,
      'created_at', v_business.created_at
    ),
    'services', COALESCE((
      SELECT jsonb_agg(to_jsonb(s) ORDER BY s.sort_order)
      FROM services s
      WHERE s.business_id = v_business.id AND s.is_active = true
    ), '[]'::jsonb),
    'staff', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', bm.id,
        'business_id', bm.business_id,
        'display_name', bm.display_name,
        'role', bm.role,
        'is_bookable', bm.is_bookable,
        'created_at', bm.created_at,
        -- deliberately nulled, never exposed publicly:
        'email', NULL,
        'user_id', NULL,
        'staff_services', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('service_id', ss.service_id))
          FROM staff_services ss WHERE ss.staff_member_id = bm.id
        ), '[]'::jsonb),
        'staff_availability', COALESCE((
          SELECT jsonb_agg(to_jsonb(sa))
          FROM staff_availability sa WHERE sa.staff_member_id = bm.id
        ), '[]'::jsonb)
      ))
      FROM business_members bm
      WHERE bm.business_id = v_business.id AND bm.is_bookable = true
    ), '[]'::jsonb),
    'business_hours', COALESCE((
      SELECT jsonb_agg(to_jsonb(bh))
      FROM business_hours bh
      WHERE bh.business_id = v_business.id
    ), '[]'::jsonb),
    'time_off', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'staff_member_id', st.staff_member_id,
        'start_at', st.start_at,
        'end_at', st.end_at
      ))
      FROM staff_time_off st
      JOIN business_members bm ON bm.id = st.staff_member_id
      WHERE bm.business_id = v_business.id
        AND bm.is_bookable = true
        AND st.end_at >= now()
    ), '[]'::jsonb),
    -- Busy windows only: no client_id, no notes.
    'appointments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'staff_member_id', a.staff_member_id,
        'start_at', a.start_at,
        'end_at', a.end_at,
        'status', a.status
      ))
      FROM appointments a
      WHERE a.business_id = v_business.id
        AND a.start_at >= now()
        AND a.status <> 'cancelled'
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_booking_context(TEXT) TO anon, authenticated;
