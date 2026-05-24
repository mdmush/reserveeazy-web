-- Split RLS policies: anon must not invoke auth-only helper functions

DROP POLICY IF EXISTS members_select ON business_members;
CREATE POLICY members_select_public ON business_members
  FOR SELECT TO anon USING (is_bookable = true);
CREATE POLICY members_select_authenticated ON business_members
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()) OR is_bookable = true);

DROP POLICY IF EXISTS staff_time_off_select ON staff_time_off;
CREATE POLICY staff_time_off_select_public ON staff_time_off
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM business_members bm
    WHERE bm.id = staff_member_id AND bm.is_bookable = true
  ));
CREATE POLICY staff_time_off_select_authenticated ON staff_time_off
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM business_members bm
    WHERE bm.id = staff_member_id
      AND (bm.business_id IN (SELECT get_user_business_ids()) OR bm.is_bookable = true)
  ));

DROP POLICY IF EXISTS clients_select ON clients;
DROP POLICY IF EXISTS clients_insert ON clients;
DROP POLICY IF EXISTS clients_update ON clients;
DROP POLICY IF EXISTS clients_delete ON clients;
CREATE POLICY clients_select ON clients FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY clients_insert ON clients FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY clients_update ON clients FOR UPDATE TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY clients_delete ON clients FOR DELETE TO authenticated
  USING (is_business_admin(business_id));

DROP POLICY IF EXISTS appointments_select ON appointments;
DROP POLICY IF EXISTS appointments_insert ON appointments;
DROP POLICY IF EXISTS appointments_update ON appointments;
DROP POLICY IF EXISTS appointments_delete ON appointments;
CREATE POLICY appointments_select ON appointments FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY appointments_insert ON appointments FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY appointments_update ON appointments FOR UPDATE TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY appointments_delete ON appointments FOR DELETE TO authenticated
  USING (is_business_admin(business_id));
