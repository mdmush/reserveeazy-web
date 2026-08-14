-- Membership build M1: class types and scheduled class sessions.
-- Classes are a parallel model to appointments (mode A stays untouched);
-- UI gates on pricing-mode capabilities.

-- class_types -----------------------------------------------------------
-- credit_cost = credits consumed when paid by a FLEXIBLE package (the spec's
-- admin-maintained credit-cost table). Locked packages always cost 1/class.
-- drop_in_price_cents feeds mode-B (pay_per_class) payment-due lines.
CREATE TABLE class_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  default_duration_minutes INT NOT NULL DEFAULT 60 CHECK (default_duration_minutes > 0),
  default_capacity INT NOT NULL DEFAULT 10 CHECK (default_capacity > 0),
  credit_cost INT NOT NULL DEFAULT 10 CHECK (credit_cost > 0),
  drop_in_price_cents INT NOT NULL DEFAULT 0 CHECK (drop_in_price_cents >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX class_types_business_name_key
  ON class_types (business_id, lower(name));
CREATE INDEX class_types_business_sort_idx ON class_types (business_id, sort_order);

ALTER TABLE class_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY class_types_select_member ON class_types
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY class_types_select_superuser ON class_types
  FOR SELECT TO authenticated USING (is_superuser());
CREATE POLICY class_types_insert_admin ON class_types
  FOR INSERT TO authenticated WITH CHECK (is_business_admin(business_id));
CREATE POLICY class_types_update_admin ON class_types
  FOR UPDATE TO authenticated
  USING (is_business_admin(business_id)) WITH CHECK (is_business_admin(business_id));
CREATE POLICY class_types_delete_admin ON class_types
  FOR DELETE TO authenticated USING (is_business_admin(business_id));

-- class_sessions --------------------------------------------------------
CREATE TABLE class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  class_type_id UUID NOT NULL REFERENCES class_types(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES business_members(id) ON DELETE RESTRICT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  room TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  recurrence_group_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

-- A teacher cannot be double-booked (spec §10 conflict rules). Cancelled
-- sessions release the slot. btree_gist lives in the extensions schema.
ALTER TABLE class_sessions ADD CONSTRAINT class_sessions_teacher_no_overlap
  EXCLUDE USING gist (teacher_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
  WHERE (status = 'scheduled');

CREATE INDEX class_sessions_business_start_idx ON class_sessions (business_id, start_at);
CREATE INDEX class_sessions_teacher_start_idx ON class_sessions (teacher_id, start_at);
CREATE INDEX class_sessions_recurrence_idx ON class_sessions (recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;

ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY class_sessions_select_member ON class_sessions
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY class_sessions_select_superuser ON class_sessions
  FOR SELECT TO authenticated USING (is_superuser());
-- Teachers read sessions; only admins write them.
CREATE POLICY class_sessions_insert_admin ON class_sessions
  FOR INSERT TO authenticated WITH CHECK (is_business_admin(business_id));
CREATE POLICY class_sessions_update_admin ON class_sessions
  FOR UPDATE TO authenticated
  USING (is_business_admin(business_id)) WITH CHECK (is_business_admin(business_id));
CREATE POLICY class_sessions_delete_admin ON class_sessions
  FOR DELETE TO authenticated USING (is_business_admin(business_id));
