-- Tenancy hardening (FSD v0.6 §1): drop the world-readable USING (true)
-- SELECT policies. Public booking pages now read through the
-- get_public_booking_context() SECURITY DEFINER RPC (previous migration), so
-- anonymous visitors no longer need — and no longer get — direct table reads.
-- Authenticated reads become membership-scoped; superuser overlay policies
-- (*_select_superuser) are untouched and keep /admin working.
--
-- This also closes the 9 Aug code-review finding: any visitor could enumerate
-- every studio's services, prices, and staff schedules.

-- businesses ---------------------------------------------------------------
DROP POLICY IF EXISTS businesses_select ON businesses;
CREATE POLICY businesses_select_member ON businesses
  FOR SELECT TO authenticated
  USING (id IN (SELECT get_user_business_ids()));

-- services -----------------------------------------------------------------
DROP POLICY IF EXISTS services_select ON services;
CREATE POLICY services_select_member ON services
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));

-- staff_services -----------------------------------------------------------
DROP POLICY IF EXISTS staff_services_select ON staff_services;
CREATE POLICY staff_services_select_member ON staff_services
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM business_members bm
    WHERE bm.id = staff_member_id
      AND bm.business_id IN (SELECT get_user_business_ids())
  ));

-- staff_availability -------------------------------------------------------
DROP POLICY IF EXISTS staff_availability_select ON staff_availability;
CREATE POLICY staff_availability_select_member ON staff_availability
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM business_members bm
    WHERE bm.id = staff_member_id
      AND bm.business_id IN (SELECT get_user_business_ids())
  ));

-- business_hours -----------------------------------------------------------
DROP POLICY IF EXISTS business_hours_select ON business_hours;
CREATE POLICY business_hours_select_member ON business_hours
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));

-- business_members: drop the anon policy and the "OR is_bookable = true"
-- cross-tenant leak from the authenticated policy.
DROP POLICY IF EXISTS members_select_public ON business_members;
DROP POLICY IF EXISTS members_select_authenticated ON business_members;
CREATE POLICY members_select_authenticated ON business_members
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));

-- staff_time_off -----------------------------------------------------------
DROP POLICY IF EXISTS staff_time_off_select_public ON staff_time_off;
DROP POLICY IF EXISTS staff_time_off_select_authenticated ON staff_time_off;
CREATE POLICY staff_time_off_select_authenticated ON staff_time_off
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM business_members bm
    WHERE bm.id = staff_member_id
      AND bm.business_id IN (SELECT get_user_business_ids())
  ));

-- Onboarding bootstrap -----------------------------------------------------
-- The onboarding flow used to INSERT ... RETURNING on businesses, which needs
-- a SELECT policy on the new row — impossible now that SELECT is
-- membership-scoped and the creator is not yet a member. Replace the
-- three-step client-side bootstrap with one atomic SECURITY DEFINER function.
CREATE OR REPLACE FUNCTION create_business(
  p_name TEXT,
  p_slug TEXT,
  p_business_type business_type,
  p_timezone TEXT,
  p_owner_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_business_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM profiles WHERE id = v_user_id;

  IF EXISTS (SELECT 1 FROM business_members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'You already belong to a business';
  END IF;

  IF EXISTS (SELECT 1 FROM businesses WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'This booking URL is already taken. Choose another slug.';
  END IF;

  INSERT INTO businesses (name, slug, business_type, timezone)
  VALUES (p_name, p_slug, p_business_type, p_timezone)
  RETURNING id INTO v_business_id;

  INSERT INTO business_members (business_id, user_id, display_name, email, role, is_bookable)
  VALUES (v_business_id, v_user_id, p_owner_name, v_email, 'owner', true);

  -- Default hours: Mon-Fri 09:00-17:00 (mirrors DEFAULT_BUSINESS_HOURS).
  INSERT INTO business_hours (business_id, day_of_week, start_time, end_time)
  SELECT v_business_id, d, '09:00', '17:00' FROM generate_series(1, 5) AS d;

  RETURN v_business_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_business(TEXT, TEXT, business_type, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_business(TEXT, TEXT, business_type, TEXT, TEXT) TO authenticated;
