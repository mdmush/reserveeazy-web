-- Membership build M6: digital registration fields, guardian-dependent family
-- links (P0-13 in the spec's numbering: guardian books for dependents;
-- dependents never log in), and versioned waivers (spec §7).
-- Publishing a new waiver version automatically forces re-acceptance because
-- the booking gate in book_class checks the CURRENT published version.

-- clients: registration + family ------------------------------------------
ALTER TABLE clients
  ADD COLUMN date_of_birth DATE,
  ADD COLUMN emergency_contact_name TEXT,
  ADD COLUMN emergency_contact_phone TEXT,
  ADD COLUMN health_declaration TEXT,
  ADD COLUMN health_flags JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN guardian_client_id UUID,
  ADD CONSTRAINT clients_business_id_id_key UNIQUE (business_id, id),
  ADD CONSTRAINT clients_guardian_same_business_fk
    FOREIGN KEY (business_id, guardian_client_id)
    REFERENCES clients (business_id, id) ON DELETE SET NULL,
  ADD CONSTRAINT clients_guardian_not_self_check
    CHECK (guardian_client_id IS DISTINCT FROM id);

CREATE INDEX clients_guardian_idx ON clients (guardian_client_id)
  WHERE guardian_client_id IS NOT NULL;

-- waiver_versions -----------------------------------------------------------
CREATE TABLE waiver_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  version INT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at TIMESTAMPTZ,  -- NULL = draft; current = max published version
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, version)
);

ALTER TABLE waiver_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY waiver_versions_select_member ON waiver_versions
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY waiver_versions_select_superuser ON waiver_versions
  FOR SELECT TO authenticated USING (is_superuser());
CREATE POLICY waiver_versions_insert_admin ON waiver_versions
  FOR INSERT TO authenticated WITH CHECK (is_business_admin(business_id));
CREATE POLICY waiver_versions_update_admin ON waiver_versions
  FOR UPDATE TO authenticated
  USING (is_business_admin(business_id)) WITH CHECK (is_business_admin(business_id));
CREATE POLICY waiver_versions_delete_admin ON waiver_versions
  FOR DELETE TO authenticated
  USING (is_business_admin(business_id) AND published_at IS NULL);  -- drafts only

-- waiver_acceptances --------------------------------------------------------
CREATE TABLE waiver_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  waiver_version_id UUID NOT NULL REFERENCES waiver_versions(id) ON DELETE RESTRICT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_by_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,  -- guardian for dependents
  signature_name TEXT NOT NULL CHECK (length(trim(signature_name)) > 0),
  recorded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  UNIQUE (client_id, waiver_version_id)
);

ALTER TABLE waiver_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY waiver_acceptances_select_member ON waiver_acceptances
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY waiver_acceptances_select_superuser ON waiver_acceptances
  FOR SELECT TO authenticated USING (is_superuser());
-- Inserts only via record_waiver_acceptance; acceptances are never edited.

-- record_waiver_acceptance --------------------------------------------------
CREATE OR REPLACE FUNCTION record_waiver_acceptance(
  p_client_id UUID,
  p_signature_name TEXT,
  p_accepted_by_client_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client clients%ROWTYPE;
  v_version_id UUID;
  v_acceptance_id UUID;
BEGIN
  SELECT * INTO v_client FROM clients WHERE id = p_client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF NOT is_business_admin(v_client.business_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_signature_name IS NULL OR length(trim(p_signature_name)) = 0 THEN
    RAISE EXCEPTION 'The signing name is required';
  END IF;

  SELECT wv.id INTO v_version_id FROM waiver_versions wv
   WHERE wv.business_id = v_client.business_id AND wv.published_at IS NOT NULL
   ORDER BY wv.version DESC LIMIT 1;
  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'No published waiver version to accept';
  END IF;

  -- For dependents, the guardian accepts on their behalf (spec §7).
  IF p_accepted_by_client_id IS NOT NULL THEN
    IF v_client.guardian_client_id IS DISTINCT FROM p_accepted_by_client_id THEN
      RAISE EXCEPTION 'Only the linked guardian can accept for a dependent';
    END IF;
  ELSIF v_client.guardian_client_id IS NOT NULL THEN
    RAISE EXCEPTION 'Dependents need their guardian to accept the waiver';
  END IF;

  INSERT INTO waiver_acceptances (
    business_id, client_id, waiver_version_id,
    accepted_by_client_id, signature_name, recorded_by
  ) VALUES (
    v_client.business_id, p_client_id, v_version_id,
    p_accepted_by_client_id, p_signature_name, auth.uid()
  )
  ON CONFLICT (client_id, waiver_version_id) DO NOTHING
  RETURNING id INTO v_acceptance_id;

  IF v_acceptance_id IS NULL THEN
    RAISE EXCEPTION 'This member already accepted the current waiver';
  END IF;

  RETURN v_acceptance_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION record_waiver_acceptance(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_waiver_acceptance(UUID, TEXT, UUID) TO authenticated;
