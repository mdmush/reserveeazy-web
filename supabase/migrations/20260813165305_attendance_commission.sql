-- Membership build M4: attendance marking, commission attribution with rate
-- snapshots, and pay-per-class payment-due lines.
-- Commission accrues per ATTENDED student (spec §5.1): the teacher whose
-- class the member attends earns it; no attendance, no commission.

-- commission_rates ---------------------------------------------------------
CREATE TABLE commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES business_members(id) ON DELETE CASCADE,
  class_type_id UUID REFERENCES class_types(id) ON DELETE CASCADE,  -- NULL = teacher default
  rate_per_head_cents INT NOT NULL CHECK (rate_per_head_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX commission_rates_unique ON commission_rates (
  business_id, teacher_id,
  COALESCE(class_type_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

ALTER TABLE commission_rates ENABLE ROW LEVEL SECURITY;
-- Rates are sensitive between teachers: admins see all, a teacher sees only
-- their own rows.
CREATE POLICY commission_rates_select ON commission_rates
  FOR SELECT TO authenticated
  USING (
    is_business_admin(business_id)
    OR teacher_id IN (
      SELECT bm.id FROM business_members bm WHERE bm.user_id = auth.uid()
    )
  );
CREATE POLICY commission_rates_select_superuser ON commission_rates
  FOR SELECT TO authenticated USING (is_superuser());
CREATE POLICY commission_rates_insert_admin ON commission_rates
  FOR INSERT TO authenticated WITH CHECK (is_business_admin(business_id));
CREATE POLICY commission_rates_update_admin ON commission_rates
  FOR UPDATE TO authenticated
  USING (is_business_admin(business_id)) WITH CHECK (is_business_admin(business_id));
CREATE POLICY commission_rates_delete_admin ON commission_rates
  FOR DELETE TO authenticated USING (is_business_admin(business_id));

-- commission_events (append-only; reversals are compensating negative rows) -
CREATE TABLE commission_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  class_session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE RESTRICT,
  class_type_id UUID NOT NULL REFERENCES class_types(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES business_members(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  rate_snapshot_cents INT NOT NULL,  -- negative on reversal
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX commission_events_business_occurred_idx
  ON commission_events (business_id, occurred_at);
CREATE INDEX commission_events_teacher_idx ON commission_events (teacher_id);
CREATE INDEX commission_events_booking_idx ON commission_events (booking_id);

ALTER TABLE commission_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY commission_events_select ON commission_events
  FOR SELECT TO authenticated
  USING (
    is_business_admin(business_id)
    OR teacher_id IN (
      SELECT bm.id FROM business_members bm WHERE bm.user_id = auth.uid()
    )
  );
CREATE POLICY commission_events_select_superuser ON commission_events
  FOR SELECT TO authenticated USING (is_superuser());
-- No write policies: written only by mark_attendance / revert_attendance.

-- payment_dues (mode B, delta §2) -------------------------------------------
CREATE TABLE payment_dues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
  class_session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE RESTRICT,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'paid', 'waived')),
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  waive_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payment_dues_business_status_idx ON payment_dues (business_id, status);
CREATE INDEX payment_dues_client_idx ON payment_dues (client_id);

ALTER TABLE payment_dues ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_dues_select_member ON payment_dues
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY payment_dues_select_superuser ON payment_dues
  FOR SELECT TO authenticated USING (is_superuser());
-- Writes only via RPCs.

ALTER TABLE payments
  ADD CONSTRAINT payments_payment_due_fk
  FOREIGN KEY (payment_due_id) REFERENCES payment_dues(id) ON DELETE SET NULL;

-- mark_attendance -----------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_attendance(
  p_booking_id UUID,
  p_present BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_session class_sessions%ROWTYPE;
  v_is_own_teacher BOOLEAN;
  v_rate INT;
  v_activated TIMESTAMPTZ;
  v_mode TEXT;
  v_due_cents INT;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  SELECT * INTO v_session FROM class_sessions WHERE id = v_booking.class_session_id;

  -- Admins, or the teacher whose session this is.
  SELECT EXISTS (
    SELECT 1 FROM business_members bm
     WHERE bm.id = v_session.teacher_id AND bm.user_id = auth.uid()
  ) INTO v_is_own_teacher;
  IF NOT (is_business_admin(v_booking.business_id) OR v_is_own_teacher) THEN
    RAISE EXCEPTION 'Only admins or the session''s teacher can mark attendance';
  END IF;

  IF v_booking.status NOT IN ('booked', 'pass_makeup') THEN
    RAISE EXCEPTION 'Attendance can only be marked for booked members (status: %)', v_booking.status;
  END IF;
  IF v_session.start_at > now() + interval '15 minutes' THEN
    RAISE EXCEPTION 'Too early to mark attendance for this session';
  END IF;

  IF p_present THEN
    UPDATE bookings SET status = 'attended' WHERE id = p_booking_id;

    -- Activation on first attendance (§6.2).
    IF v_booking.paid_by_package_instance_id IS NOT NULL THEN
      v_activated := _activate_instance(
        v_booking.paid_by_package_instance_id, v_session.start_at
      );
    END IF;

    -- Commission event with rate snapshot: per-class-type rate wins over the
    -- teacher default; missing rates record 0 so headcount still reports.
    SELECT COALESCE(
      (SELECT rate_per_head_cents FROM commission_rates
        WHERE teacher_id = v_session.teacher_id
          AND class_type_id = v_session.class_type_id),
      (SELECT rate_per_head_cents FROM commission_rates
        WHERE teacher_id = v_session.teacher_id AND class_type_id IS NULL),
      0
    ) INTO v_rate;

    INSERT INTO commission_events (
      business_id, booking_id, class_session_id, class_type_id,
      teacher_id, client_id, rate_snapshot_cents, occurred_at
    ) VALUES (
      v_booking.business_id, p_booking_id, v_session.id, v_session.class_type_id,
      v_session.teacher_id, v_booking.client_id, v_rate, now()
    );

    -- Mode B: attendance creates a payment-due line at the drop-in price.
    SELECT b.pricing_mode INTO v_mode FROM businesses b WHERE b.id = v_booking.business_id;
    IF v_mode = 'pay_per_class' THEN
      SELECT ct.drop_in_price_cents INTO v_due_cents
        FROM class_types ct WHERE ct.id = v_session.class_type_id;
      INSERT INTO payment_dues (
        business_id, client_id, booking_id, class_session_id, amount_cents
      ) VALUES (
        v_booking.business_id, v_booking.client_id, p_booking_id,
        v_session.id, COALESCE(v_due_cents, 0)
      );
    END IF;

    RETURN jsonb_build_object(
      'status', 'attended',
      'activated_expiry', v_activated,
      'commission_cents', v_rate
    );
  ELSE
    UPDATE bookings SET status = 'no_show' WHERE id = p_booking_id;
    INSERT INTO credit_transactions (
      business_id, client_id, package_instance_id, booking_id,
      kind, amount, actor_user_id, reason
    ) VALUES (
      v_booking.business_id, v_booking.client_id,
      v_booking.paid_by_package_instance_id, p_booking_id,
      'forfeit', 0, auth.uid(), 'No-show'
    );
    -- Anti-parking: a no-show of the first booking also activates (§6.2).
    IF v_booking.paid_by_package_instance_id IS NOT NULL THEN
      v_activated := _activate_instance(
        v_booking.paid_by_package_instance_id, v_session.start_at
      );
    END IF;
    RETURN jsonb_build_object('status', 'no_show', 'activated_expiry', v_activated);
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION mark_attendance(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mark_attendance(UUID, BOOLEAN) TO authenticated;

-- revert_attendance (admin correction; append-only stores stay append-only) -
CREATE OR REPLACE FUNCTION revert_attendance(
  p_booking_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_prior_status booking_status;
  v_commission_sum INT;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF NOT is_business_admin(v_booking.business_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required to revert attendance';
  END IF;
  IF v_booking.status NOT IN ('attended', 'no_show') THEN
    RAISE EXCEPTION 'Only attended/no-show bookings can be reverted';
  END IF;

  v_prior_status := CASE WHEN v_booking.grace_pass_id IS NOT NULL
                         THEN 'pass_makeup'::booking_status
                         ELSE 'booked'::booking_status END;

  IF v_booking.status = 'attended' THEN
    -- Compensating negative commission row (never delete).
    SELECT COALESCE(sum(rate_snapshot_cents), 0) INTO v_commission_sum
      FROM commission_events WHERE booking_id = p_booking_id;
    IF v_commission_sum <> 0 THEN
      INSERT INTO commission_events (
        business_id, booking_id, class_session_id, class_type_id,
        teacher_id, client_id, rate_snapshot_cents
      )
      SELECT business_id, booking_id, class_session_id, class_type_id,
             teacher_id, client_id, -v_commission_sum
        FROM commission_events
       WHERE booking_id = p_booking_id
       ORDER BY id ASC LIMIT 1;
    END IF;
    -- Unpaid dues are records, not ledgers — remove them.
    DELETE FROM payment_dues
     WHERE booking_id = p_booking_id AND status = 'due';
  END IF;

  UPDATE bookings SET status = v_prior_status WHERE id = p_booking_id;

  INSERT INTO credit_transactions (
    business_id, client_id, package_instance_id, booking_id,
    kind, amount, actor_user_id, reason
  ) VALUES (
    v_booking.business_id, v_booking.client_id,
    v_booking.paid_by_package_instance_id, p_booking_id,
    'manual_adjustment', 0, auth.uid(), 'Attendance reverted: ' || p_reason
  );

  RETURN jsonb_build_object('status', v_prior_status);
END;
$$;
REVOKE EXECUTE ON FUNCTION revert_attendance(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION revert_attendance(UUID, TEXT) TO authenticated;

-- record_due_payment / waive_due (mode B settlements) -----------------------
CREATE OR REPLACE FUNCTION record_due_payment(
  p_payment_due_id UUID,
  p_method TEXT,
  p_amount_cents INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_due payment_dues%ROWTYPE;
  v_amount INT;
  v_receipt_no INT;
  v_receipt_number TEXT;
  v_payment_id UUID;
BEGIN
  SELECT * INTO v_due FROM payment_dues WHERE id = p_payment_due_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment due not found'; END IF;
  IF NOT is_business_admin(v_due.business_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF v_due.status <> 'due' THEN
    RAISE EXCEPTION 'This due is already %', v_due.status;
  END IF;

  v_amount := COALESCE(p_amount_cents, v_due.amount_cents);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be positive'; END IF;

  v_receipt_no := _next_receipt_number(v_due.business_id);
  v_receipt_number := 'R-' || lpad(v_receipt_no::text, 6, '0');

  INSERT INTO payments (
    business_id, client_id, payment_due_id, amount_cents, method,
    receipt_no, receipt_number, recorded_by
  ) VALUES (
    v_due.business_id, v_due.client_id, p_payment_due_id, v_amount, p_method,
    v_receipt_no, v_receipt_number, auth.uid()
  ) RETURNING id INTO v_payment_id;

  UPDATE payment_dues SET status = 'paid', payment_id = v_payment_id
   WHERE id = p_payment_due_id;

  RETURN jsonb_build_object('payment_id', v_payment_id, 'receipt_number', v_receipt_number);
END;
$$;
REVOKE EXECUTE ON FUNCTION record_due_payment(UUID, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_due_payment(UUID, TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION waive_due(
  p_payment_due_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_due payment_dues%ROWTYPE;
BEGIN
  SELECT * INTO v_due FROM payment_dues WHERE id = p_payment_due_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment due not found'; END IF;
  IF NOT is_business_admin(v_due.business_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF v_due.status <> 'due' THEN
    RAISE EXCEPTION 'This due is already %', v_due.status;
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required to waive a due';
  END IF;

  UPDATE payment_dues SET status = 'waived', waive_reason = p_reason
   WHERE id = p_payment_due_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION waive_due(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION waive_due(UUID, TEXT) TO authenticated;
