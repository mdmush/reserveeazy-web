-- Avoid calling auth-only helpers for anonymous users in RLS

DROP POLICY IF EXISTS members_select ON business_members;
CREATE POLICY members_select ON business_members FOR SELECT
  USING (
    is_bookable = true
    OR (
      (SELECT auth.uid()) IS NOT NULL
      AND business_id IN (SELECT get_user_business_ids())
    )
  );

DROP POLICY IF EXISTS staff_time_off_select ON staff_time_off;
CREATE POLICY staff_time_off_select ON staff_time_off FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_members bm
      WHERE bm.id = staff_member_id
        AND bm.is_bookable = true
    )
    OR (
      (SELECT auth.uid()) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM business_members bm
        WHERE bm.id = staff_member_id
          AND bm.business_id IN (SELECT get_user_business_ids())
      )
    )
  );

DROP POLICY IF EXISTS clients_select ON clients;
CREATE POLICY clients_select ON clients FOR SELECT
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND business_id IN (SELECT get_user_business_ids())
  );

DROP POLICY IF EXISTS clients_insert ON clients;
CREATE POLICY clients_insert ON clients FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND business_id IN (SELECT get_user_business_ids())
  );

DROP POLICY IF EXISTS clients_update ON clients;
CREATE POLICY clients_update ON clients FOR UPDATE
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND business_id IN (SELECT get_user_business_ids())
  );

DROP POLICY IF EXISTS appointments_select ON appointments;
CREATE POLICY appointments_select ON appointments FOR SELECT
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND business_id IN (SELECT get_user_business_ids())
  );

DROP POLICY IF EXISTS appointments_insert ON appointments;
CREATE POLICY appointments_insert ON appointments FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND business_id IN (SELECT get_user_business_ids())
  );

DROP POLICY IF EXISTS appointments_update ON appointments;
CREATE POLICY appointments_update ON appointments FOR UPDATE
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND business_id IN (SELECT get_user_business_ids())
  );
