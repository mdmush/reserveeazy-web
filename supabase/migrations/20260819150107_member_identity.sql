-- Member portal M-A: link clients to auth users, add the member RLS tier,
-- and the join_studio registration RPC.
-- A member is a clients row with user_id set; guardians act for dependents
-- via clients.guardian_client_id. Same email may be a client at multiple
-- studios, so all helpers return sets.

-- clients <-> auth link ------------------------------------------------------
ALTER TABLE clients
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- One portal account per client per studio.
CREATE UNIQUE INDEX clients_business_user_idx
  ON clients (business_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX clients_user_idx ON clients (user_id) WHERE user_id IS NOT NULL;

-- Helpers --------------------------------------------------------------------
-- Own clients plus their dependents.
CREATE OR REPLACE FUNCTION get_member_client_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id FROM clients c WHERE c.user_id = auth.uid()
  UNION
  SELECT d.id FROM clients d
    JOIN clients g ON g.id = d.guardian_client_id
   WHERE g.user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION get_member_client_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_member_client_ids() TO authenticated;

CREATE OR REPLACE FUNCTION get_member_business_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT business_id FROM clients WHERE user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION get_member_business_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_member_business_ids() TO authenticated;

-- Engine-internal authorization: admins, the member themself, or the linked
-- guardian may act for a client. Not callable directly (like _seats_taken).
CREATE OR REPLACE FUNCTION _can_act_for_client(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM clients c
    LEFT JOIN clients g ON g.id = c.guardian_client_id
    WHERE c.id = p_client_id
      AND (c.user_id = auth.uid()
        OR g.user_id = auth.uid()
        OR is_business_admin(c.business_id))
  );
$$;
REVOKE EXECUTE ON FUNCTION _can_act_for_client(UUID) FROM PUBLIC, anon, authenticated;

-- Member RLS tier: additive SELECT-only policies. Engine tables keep zero
-- write policies. Deliberately NO member policies on class_sessions or
-- business_members — teacher emails and other members' seats would leak;
-- schedule data flows through SECURITY DEFINER RPCs instead.
CREATE POLICY businesses_select_linked_client ON businesses
  FOR SELECT TO authenticated
  USING (id IN (SELECT get_member_business_ids()));

CREATE POLICY clients_select_linked ON clients
  FOR SELECT TO authenticated
  USING (id IN (SELECT get_member_client_ids()));

CREATE POLICY package_instances_select_linked_client ON package_instances
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT get_member_client_ids()));

CREATE POLICY credit_transactions_select_linked_client ON credit_transactions
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT get_member_client_ids()));

CREATE POLICY payments_select_linked_client ON payments
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT get_member_client_ids()));

CREATE POLICY payment_dues_select_linked_client ON payment_dues
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT get_member_client_ids()));

CREATE POLICY grace_passes_select_linked_client ON grace_passes
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT get_member_client_ids()));

CREATE POLICY bookings_select_linked_client ON bookings
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT get_member_client_ids()));

CREATE POLICY waiver_acceptances_select_linked_client ON waiver_acceptances
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT get_member_client_ids()));

CREATE POLICY class_types_select_linked_client ON class_types
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_member_business_ids()));

CREATE POLICY packages_select_linked_client ON packages
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_member_business_ids()));

CREATE POLICY waiver_versions_select_linked_client ON waiver_versions
  FOR SELECT TO authenticated
  USING (
    published_at IS NOT NULL
    AND business_id IN (SELECT get_member_business_ids())
  );

-- join_studio ----------------------------------------------------------------
-- Open registration via /join/[slug]: claims the studio's existing client
-- record by email, or creates a new one. Idempotent per (business, user).
CREATE OR REPLACE FUNCTION join_studio(
  p_slug TEXT,
  p_full_name TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business businesses%ROWTYPE;
  v_email TEXT;
  v_client clients%ROWTYPE;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Your account has no email address';
  END IF;

  SELECT * INTO v_business FROM businesses WHERE slug = p_slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'Studio not found'; END IF;
  IF v_business.pricing_mode NOT IN ('pay_per_class', 'credits') THEN
    RAISE EXCEPTION 'This studio does not offer online membership';
  END IF;
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'Your name is required';
  END IF;

  -- Already linked here → idempotent.
  SELECT id INTO v_id FROM clients
   WHERE business_id = v_business.id AND user_id = auth.uid();
  IF FOUND THEN RETURN v_id; END IF;

  -- Claim the studio's existing record by email (at most one row exists per
  -- the partial unique index). Front-desk full_name wins over the form's.
  SELECT * INTO v_client FROM clients
   WHERE business_id = v_business.id AND lower(email) = lower(v_email)
   FOR UPDATE;
  IF FOUND THEN
    IF v_client.user_id IS NOT NULL THEN
      RAISE EXCEPTION 'This member profile is already linked to another account';
    END IF;
    UPDATE clients
       SET user_id = auth.uid(),
           phone = COALESCE(NULLIF(trim(p_phone), ''), phone)
     WHERE id = v_client.id;
    RETURN v_client.id;
  END IF;

  INSERT INTO clients (business_id, full_name, email, phone, user_id)
  VALUES (
    v_business.id, trim(p_full_name), lower(v_email),
    NULLIF(trim(p_phone), ''), auth.uid()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION join_studio(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION join_studio(TEXT, TEXT, TEXT) TO authenticated;
