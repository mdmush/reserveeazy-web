-- Security hardening: restrict internal helper RPCs from public API

REVOKE EXECUTE ON FUNCTION public.is_business_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_business_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_business_ids() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Re-grant to authenticated (required for RLS policy evaluation)
GRANT EXECUTE ON FUNCTION public.get_user_business_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_member(uuid) TO authenticated;

-- create_public_booking remains callable by anon (required for public booking widget)

-- Consolidate duplicate businesses SELECT policies for performance
DROP POLICY IF EXISTS businesses_select_member ON businesses;
DROP POLICY IF EXISTS businesses_select_public ON businesses;
CREATE POLICY businesses_select ON businesses FOR SELECT USING (true);

-- Add missing FK indexes (performance advisor)
CREATE INDEX IF NOT EXISTS appointments_client_id_idx ON appointments (client_id);
CREATE INDEX IF NOT EXISTS appointments_service_id_idx ON appointments (service_id);
CREATE INDEX IF NOT EXISTS business_members_user_id_idx ON business_members (user_id);
CREATE INDEX IF NOT EXISTS staff_availability_staff_member_id_idx ON staff_availability (staff_member_id);
CREATE INDEX IF NOT EXISTS staff_services_service_id_idx ON staff_services (service_id);
CREATE INDEX IF NOT EXISTS staff_time_off_staff_member_id_idx ON staff_time_off (staff_member_id);

-- Optimize RLS policies: wrap auth.uid() in subselect
DROP POLICY IF EXISTS profiles_select_own ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_select_own ON profiles FOR SELECT USING (id = (SELECT auth.uid()));
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS businesses_insert ON businesses;
CREATE POLICY businesses_insert ON businesses FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS members_insert_admin ON business_members;
CREATE POLICY members_insert_admin ON business_members FOR INSERT
  WITH CHECK (is_business_admin(business_id) OR (
    (SELECT auth.uid()) IS NOT NULL AND role = 'owner' AND user_id = (SELECT auth.uid())
  ));
