-- Business-wide operating hours and availability enforcement

CREATE TABLE business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time),
  UNIQUE (business_id, day_of_week, start_time, end_time)
);

CREATE INDEX business_hours_business_id_idx ON business_hours (business_id, day_of_week);

ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_hours_select ON business_hours FOR SELECT USING (true);
CREATE POLICY business_hours_insert ON business_hours FOR INSERT
  WITH CHECK (is_business_admin(business_id));
CREATE POLICY business_hours_update ON business_hours FOR UPDATE
  USING (is_business_admin(business_id));
CREATE POLICY business_hours_delete ON business_hours FOR DELETE
  USING (is_business_admin(business_id));

CREATE POLICY business_hours_select_superuser ON business_hours
  FOR SELECT TO authenticated
  USING (is_superuser());

-- Default slot interval: 60 minutes for new businesses
ALTER TABLE businesses ALTER COLUMN settings SET DEFAULT '{
  "slot_interval_minutes": 60,
  "min_notice_hours": 2,
  "max_advance_days": 60,
  "auto_confirm": true
}'::jsonb;

-- Backfill Mon–Fri 9–5 for existing businesses without hours
INSERT INTO business_hours (business_id, day_of_week, start_time, end_time)
SELECT b.id, d.day_of_week, '09:00'::TIME, '17:00'::TIME
FROM businesses b
CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS d(day_of_week)
WHERE NOT EXISTS (
  SELECT 1 FROM business_hours bh WHERE bh.business_id = b.id
);

CREATE OR REPLACE FUNCTION create_public_booking(
  p_business_slug TEXT,
  p_service_id UUID,
  p_staff_member_id UUID,
  p_start_at TIMESTAMPTZ,
  p_client_name TEXT,
  p_client_email TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business businesses%ROWTYPE;
  v_service services%ROWTYPE;
  v_staff business_members%ROWTYPE;
  v_end_at TIMESTAMPTZ;
  v_client_id UUID;
  v_appointment_id UUID;
  v_status appointment_status;
  v_settings JSONB;
  v_min_notice INTERVAL;
  v_max_advance INTERVAL;
  v_local_start TIMESTAMP;
  v_local_end TIMESTAMP;
  v_day_of_week SMALLINT;
  v_has_staff_hours BOOLEAN;
BEGIN
  SELECT * INTO v_business FROM businesses WHERE slug = p_business_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  SELECT * INTO v_service FROM services
  WHERE id = p_service_id AND business_id = v_business.id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found';
  END IF;

  SELECT * INTO v_staff FROM business_members
  WHERE id = p_staff_member_id AND business_id = v_business.id AND is_bookable = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM staff_services
    WHERE staff_member_id = p_staff_member_id AND service_id = p_service_id
  ) THEN
    RAISE EXCEPTION 'Staff cannot perform this service';
  END IF;

  v_end_at := p_start_at + (v_service.duration_minutes || ' minutes')::interval;
  v_settings := v_business.settings;
  v_min_notice := ((v_settings->>'min_notice_hours')::numeric || ' hours')::interval;
  v_max_advance := ((v_settings->>'max_advance_days')::numeric || ' days')::interval;

  IF p_start_at < now() + v_min_notice THEN
    RAISE EXCEPTION 'Booking too soon';
  END IF;

  IF p_start_at > now() + v_max_advance THEN
    RAISE EXCEPTION 'Booking too far in advance';
  END IF;

  v_local_start := p_start_at AT TIME ZONE v_business.timezone;
  v_local_end := v_end_at AT TIME ZONE v_business.timezone;
  v_day_of_week := EXTRACT(DOW FROM v_local_start)::SMALLINT;

  IF NOT EXISTS (
    SELECT 1 FROM business_hours bh
    WHERE bh.business_id = v_business.id
      AND bh.day_of_week = v_day_of_week
      AND v_local_start::TIME >= bh.start_time
      AND v_local_end::TIME <= bh.end_time
  ) THEN
    RAISE EXCEPTION 'Outside business hours';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM staff_availability sa WHERE sa.staff_member_id = p_staff_member_id
  ) INTO v_has_staff_hours;

  IF v_has_staff_hours AND NOT EXISTS (
    SELECT 1 FROM staff_availability sa
    WHERE sa.staff_member_id = p_staff_member_id
      AND sa.day_of_week = v_day_of_week
      AND v_local_start::TIME >= sa.start_time
      AND v_local_end::TIME <= sa.end_time
  ) THEN
    RAISE EXCEPTION 'Outside staff availability';
  END IF;

  IF EXISTS (
    SELECT 1 FROM appointments
    WHERE staff_member_id = p_staff_member_id
      AND status NOT IN ('cancelled')
      AND tstzrange(start_at, end_at, '[)') && tstzrange(p_start_at, v_end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Time slot unavailable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM staff_time_off
    WHERE staff_member_id = p_staff_member_id
      AND tstzrange(start_at, end_at, '[)') && tstzrange(p_start_at, v_end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Staff unavailable';
  END IF;

  IF p_client_email IS NOT NULL AND p_client_email <> '' THEN
    SELECT id INTO v_client_id FROM clients
    WHERE business_id = v_business.id AND lower(email) = lower(p_client_email)
    LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN
    INSERT INTO clients (business_id, full_name, email, phone)
    VALUES (v_business.id, p_client_name, p_client_email, p_client_phone)
    RETURNING id INTO v_client_id;
  ELSE
    UPDATE clients SET
      full_name = p_client_name,
      phone = COALESCE(p_client_phone, phone)
    WHERE id = v_client_id;
  END IF;

  IF (v_settings->>'auto_confirm')::boolean THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending';
  END IF;

  INSERT INTO appointments (
    business_id, client_id, staff_member_id, service_id,
    start_at, end_at, status, source
  ) VALUES (
    v_business.id, v_client_id, p_staff_member_id, p_service_id,
    p_start_at, v_end_at, v_status, 'online_booking'
  ) RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_public_booking TO anon, authenticated;
