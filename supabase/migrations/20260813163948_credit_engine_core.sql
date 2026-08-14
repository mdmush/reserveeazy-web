-- Membership build M2: packages, package instances, the immutable credit
-- ledger, per-business receipt numbering, and payment records.
-- Invariants: ledger is append-only (zero write policies — rows are written
-- only inside SECURITY DEFINER RPCs); balances are always derived; instance
-- rows snapshot their package so product edits never rewrite sold packages.

-- packages (products) ----------------------------------------------------
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('locked', 'flexible')),
  class_type_id UUID REFERENCES class_types(id) ON DELETE RESTRICT,
  credit_count INT NOT NULL CHECK (credit_count > 0),
  validity_days INT NOT NULL CHECK (validity_days > 0),
  expiry_trigger TEXT NOT NULL DEFAULT 'first_attendance'
    CHECK (expiry_trigger IN ('first_attendance', 'purchase')),
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Locked packages name their class type; flexible ones must not.
  CHECK ((scope = 'locked') = (class_type_id IS NOT NULL))
);

CREATE INDEX packages_business_sort_idx ON packages (business_id, sort_order);

ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY packages_select_member ON packages
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY packages_select_superuser ON packages
  FOR SELECT TO authenticated USING (is_superuser());
CREATE POLICY packages_insert_admin ON packages
  FOR INSERT TO authenticated WITH CHECK (is_business_admin(business_id));
CREATE POLICY packages_update_admin ON packages
  FOR UPDATE TO authenticated
  USING (is_business_admin(business_id)) WITH CHECK (is_business_admin(business_id));
CREATE POLICY packages_delete_admin ON packages
  FOR DELETE TO authenticated USING (is_business_admin(business_id));

-- package_instances (member <-> package) ---------------------------------
CREATE TABLE package_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  -- snapshots at sale
  scope TEXT NOT NULL CHECK (scope IN ('locked', 'flexible')),
  class_type_id UUID REFERENCES class_types(id) ON DELETE RESTRICT,
  credit_count INT NOT NULL CHECK (credit_count > 0),
  validity_days INT NOT NULL CHECK (validity_days > 0),
  expiry_trigger TEXT NOT NULL
    CHECK (expiry_trigger IN ('first_attendance', 'purchase')),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,  -- NULL = unactivated ("starts on first attendance")
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK ((scope = 'locked') = (class_type_id IS NOT NULL))
);

CREATE INDEX package_instances_business_client_idx
  ON package_instances (business_id, client_id);
CREATE INDEX package_instances_client_expiry_idx
  ON package_instances (client_id, expires_at);

ALTER TABLE package_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY package_instances_select_member ON package_instances
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY package_instances_select_superuser ON package_instances
  FOR SELECT TO authenticated USING (is_superuser());
-- No INSERT policy: instances are created only by assign_package(), keeping
-- sale + grant + payment + receipt atomic. Admin UPDATE covers exceptional
-- expiry extensions; credit corrections go through adjust_credits().
CREATE POLICY package_instances_update_admin ON package_instances
  FOR UPDATE TO authenticated
  USING (is_business_admin(business_id)) WITH CHECK (is_business_admin(business_id));

-- credit_transactions (append-only ledger, P0-7) --------------------------
CREATE TABLE credit_transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  package_instance_id UUID REFERENCES package_instances(id) ON DELETE RESTRICT,
  booking_id UUID,  -- FK added in the bookings migration
  kind TEXT NOT NULL CHECK (kind IN (
    'purchase_grant', 'deduction', 'refund', 'forfeit',
    'pass_grant', 'pass_redemption', 'manual_adjustment'
  )),
  amount INT NOT NULL,          -- signed credits; audit markers use 0
  cost_snapshot INT,            -- credit cost charged at booking time
  reason TEXT,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX credit_transactions_instance_idx
  ON credit_transactions (package_instance_id);
CREATE INDEX credit_transactions_business_client_idx
  ON credit_transactions (business_id, client_id, created_at);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_transactions_select_member ON credit_transactions
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY credit_transactions_select_superuser ON credit_transactions
  FOR SELECT TO authenticated USING (is_superuser());
-- Append-only by construction: no INSERT/UPDATE/DELETE policies exist.

CREATE VIEW package_instance_balances
WITH (security_invoker = true) AS
  SELECT package_instance_id,
         business_id,
         client_id,
         sum(amount)::int AS balance
    FROM credit_transactions
   WHERE package_instance_id IS NOT NULL
   GROUP BY package_instance_id, business_id, client_id;

-- receipt_counters --------------------------------------------------------
-- Counter row per business (not a sequence): gapless and transactional under
-- row-lock serialization, which suits e-invoice-compatible numbering.
CREATE TABLE receipt_counters (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  next_number INT NOT NULL DEFAULT 1
);
ALTER TABLE receipt_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY receipt_counters_select_admin ON receipt_counters
  FOR SELECT TO authenticated USING (is_business_admin(business_id));
-- Writes happen only inside RPCs.

-- payments (P0-8) ---------------------------------------------------------
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  package_instance_id UUID REFERENCES package_instances(id) ON DELETE RESTRICT,
  payment_due_id UUID,  -- FK added in the attendance migration
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  method TEXT NOT NULL CHECK (method IN (
    'cash', 'bank_transfer', 'tng', 'duitnow_qr', 'card', 'other'
  )),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  receipt_no INT NOT NULL,
  receipt_number TEXT NOT NULL,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (business_id, receipt_no)
);

CREATE INDEX payments_business_paid_idx ON payments (business_id, paid_at);
CREATE INDEX payments_client_idx ON payments (client_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_select_member ON payments
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY payments_select_superuser ON payments
  FOR SELECT TO authenticated USING (is_superuser());
-- Writes happen only inside RPCs (numbering must be unforgeable).

-- Internal: next receipt number for a business (row-locked, gapless).
CREATE OR REPLACE FUNCTION _next_receipt_number(p_business_id UUID)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_no INT;
BEGIN
  INSERT INTO receipt_counters (business_id)
  VALUES (p_business_id)
  ON CONFLICT (business_id) DO NOTHING;

  UPDATE receipt_counters
     SET next_number = next_number + 1
   WHERE business_id = p_business_id
  RETURNING next_number - 1 INTO v_no;

  RETURN v_no;
END;
$$;
REVOKE EXECUTE ON FUNCTION _next_receipt_number(UUID) FROM PUBLIC, anon, authenticated;

-- assign_package: sale + credit grant + payment + receipt, atomically -----
CREATE OR REPLACE FUNCTION assign_package(
  p_client_id UUID,
  p_package_id UUID,
  p_amount_cents INT,
  p_method TEXT,
  p_paid_at TIMESTAMPTZ DEFAULT now(),
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_package packages%ROWTYPE;
  v_client clients%ROWTYPE;
  v_instance_id UUID;
  v_receipt_no INT;
  v_receipt_number TEXT;
  v_payment_id UUID;
  v_activated_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_package FROM packages WHERE id = p_package_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found'; END IF;
  IF NOT is_business_admin(v_package.business_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF NOT v_package.is_active THEN
    RAISE EXCEPTION 'Package is inactive';
  END IF;

  SELECT * INTO v_client FROM clients
   WHERE id = p_client_id AND business_id = v_package.business_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client not found'; END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  IF v_package.expiry_trigger = 'purchase' THEN
    v_activated_at := COALESCE(p_paid_at, now());
    v_expires_at := v_activated_at + make_interval(days => v_package.validity_days);
  END IF;

  INSERT INTO package_instances (
    business_id, package_id, client_id,
    scope, class_type_id, credit_count, validity_days, expiry_trigger,
    purchased_at, activated_at, expires_at, created_by
  ) VALUES (
    v_package.business_id, v_package.id, p_client_id,
    v_package.scope, v_package.class_type_id, v_package.credit_count,
    v_package.validity_days, v_package.expiry_trigger,
    COALESCE(p_paid_at, now()), v_activated_at, v_expires_at, auth.uid()
  ) RETURNING id INTO v_instance_id;

  INSERT INTO credit_transactions (
    business_id, client_id, package_instance_id, kind, amount, actor_user_id
  ) VALUES (
    v_package.business_id, p_client_id, v_instance_id,
    'purchase_grant', v_package.credit_count, auth.uid()
  );

  v_receipt_no := _next_receipt_number(v_package.business_id);
  v_receipt_number := 'R-' || lpad(v_receipt_no::text, 6, '0');

  INSERT INTO payments (
    business_id, client_id, package_instance_id, amount_cents, method,
    paid_at, receipt_no, receipt_number, notes, recorded_by
  ) VALUES (
    v_package.business_id, p_client_id, v_instance_id, p_amount_cents, p_method,
    COALESCE(p_paid_at, now()), v_receipt_no, v_receipt_number, p_notes, auth.uid()
  ) RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object(
    'package_instance_id', v_instance_id,
    'payment_id', v_payment_id,
    'receipt_number', v_receipt_number
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION assign_package(UUID, UUID, INT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION assign_package(UUID, UUID, INT, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

-- adjust_credits: admin manual adjustment, always ledgered ----------------
CREATE OR REPLACE FUNCTION adjust_credits(
  p_package_instance_id UUID,
  p_amount INT,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance package_instances%ROWTYPE;
  v_balance INT;
BEGIN
  SELECT * INTO v_instance FROM package_instances
   WHERE id = p_package_instance_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package instance not found'; END IF;
  IF NOT is_business_admin(v_instance.business_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required for manual adjustments';
  END IF;
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'Adjustment amount cannot be zero';
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_balance
    FROM credit_transactions
   WHERE package_instance_id = p_package_instance_id;
  IF v_balance + p_amount < 0 THEN
    RAISE EXCEPTION 'Adjustment would make the balance negative';
  END IF;

  INSERT INTO credit_transactions (
    business_id, client_id, package_instance_id, kind, amount, reason, actor_user_id
  ) VALUES (
    v_instance.business_id, v_instance.client_id, p_package_instance_id,
    'manual_adjustment', p_amount, p_reason, auth.uid()
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION adjust_credits(UUID, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION adjust_credits(UUID, INT, TEXT) TO authenticated;
