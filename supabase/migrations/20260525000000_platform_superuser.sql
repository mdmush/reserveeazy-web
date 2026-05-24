-- Platform superuser: cross-tenant read access for platform operators

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_superuser BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION is_superuser()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_superuser = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_superuser() TO authenticated;

-- Prevent users from promoting themselves via the client API
DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND is_superuser = (SELECT p.is_superuser FROM profiles p WHERE p.id = auth.uid())
  );

-- Superuser read policies (additive; do not alter anon/public booking policies)
CREATE POLICY profiles_select_superuser ON profiles
  FOR SELECT TO authenticated
  USING (is_superuser());

CREATE POLICY businesses_select_superuser ON businesses
  FOR SELECT TO authenticated
  USING (is_superuser());

CREATE POLICY members_select_superuser ON business_members
  FOR SELECT TO authenticated
  USING (is_superuser());

CREATE POLICY services_select_superuser ON services
  FOR SELECT TO authenticated
  USING (is_superuser());

CREATE POLICY staff_services_select_superuser ON staff_services
  FOR SELECT TO authenticated
  USING (is_superuser());

CREATE POLICY staff_availability_select_superuser ON staff_availability
  FOR SELECT TO authenticated
  USING (is_superuser());

CREATE POLICY staff_time_off_select_superuser ON staff_time_off
  FOR SELECT TO authenticated
  USING (is_superuser());

CREATE POLICY clients_select_superuser ON clients
  FOR SELECT TO authenticated
  USING (is_superuser());

CREATE POLICY appointments_select_superuser ON appointments
  FOR SELECT TO authenticated
  USING (is_superuser());
