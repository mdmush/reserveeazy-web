-- ReserveEazy core booking schema

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Enums
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'staff');
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
CREATE TYPE appointment_source AS ENUM ('dashboard', 'online_booking');
CREATE TYPE business_type AS ENUM ('salon', 'spa', 'barber', 'nail_studio', 'clinic', 'pet_grooming', 'other');

-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Businesses (tenants)
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  business_type business_type NOT NULL DEFAULT 'other',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  settings JSONB NOT NULL DEFAULT '{
    "slot_interval_minutes": 15,
    "min_notice_hours": 2,
    "max_advance_days": 60,
    "auto_confirm": true
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Business members / staff
CREATE TABLE business_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  role member_role NOT NULL DEFAULT 'staff',
  is_bookable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

-- Services
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Staff ↔ services
CREATE TABLE staff_services (
  staff_member_id UUID NOT NULL REFERENCES business_members(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_member_id, service_id)
);

-- Weekly availability (day_of_week: 0=Sunday .. 6=Saturday)
CREATE TABLE staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id UUID NOT NULL REFERENCES business_members(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time)
);

-- Time off
CREATE TABLE staff_time_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id UUID NOT NULL REFERENCES business_members(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL CHECK (end_at > start_at),
  reason TEXT
);

-- Clients (per business)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX clients_business_email_idx ON clients (business_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';

-- Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  staff_member_id UUID NOT NULL REFERENCES business_members(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL CHECK (end_at > start_at),
  status appointment_status NOT NULL DEFAULT 'confirmed',
  notes TEXT,
  source appointment_source NOT NULL DEFAULT 'dashboard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX appointments_business_start_idx ON appointments (business_id, start_at);
CREATE INDEX appointments_staff_start_idx ON appointments (staff_member_id, start_at);
CREATE INDEX services_business_idx ON services (business_id, sort_order);
CREATE INDEX clients_business_idx ON clients (business_id, full_name);
CREATE INDEX business_members_business_idx ON business_members (business_id);

-- Prevent overlapping appointments per staff
ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    staff_member_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status NOT IN ('cancelled'));

-- Helper: is member of business
CREATE OR REPLACE FUNCTION is_business_member(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_members
    WHERE business_id = p_business_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_business_admin(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_members
    WHERE business_id = p_business_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION get_user_business_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id FROM business_members WHERE user_id = auth.uid();
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY profiles_select_own ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (id = auth.uid());

-- Businesses
CREATE POLICY businesses_select_member ON businesses FOR SELECT
  USING (id IN (SELECT get_user_business_ids()));
CREATE POLICY businesses_select_public ON businesses FOR SELECT
  USING (true);
CREATE POLICY businesses_insert ON businesses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY businesses_update_admin ON businesses FOR UPDATE
  USING (is_business_admin(id));

-- Business members
CREATE POLICY members_select ON business_members FOR SELECT
  USING (business_id IN (SELECT get_user_business_ids()) OR is_bookable = true);
CREATE POLICY members_insert_admin ON business_members FOR INSERT
  WITH CHECK (is_business_admin(business_id) OR (
    auth.uid() IS NOT NULL AND role = 'owner' AND user_id = auth.uid()
  ));
CREATE POLICY members_update_admin ON business_members FOR UPDATE
  USING (is_business_admin(business_id));
CREATE POLICY members_delete_admin ON business_members FOR DELETE
  USING (is_business_admin(business_id));

-- Services (public read for active services via join in app; allow anon select active)
CREATE POLICY services_select ON services FOR SELECT USING (true);
CREATE POLICY services_insert ON services FOR INSERT
  WITH CHECK (is_business_admin(business_id));
CREATE POLICY services_update ON services FOR UPDATE
  USING (is_business_admin(business_id));
CREATE POLICY services_delete ON services FOR DELETE
  USING (is_business_admin(business_id));

-- Staff services
CREATE POLICY staff_services_select ON staff_services FOR SELECT USING (true);
CREATE POLICY staff_services_insert ON staff_services FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members bm
      JOIN services s ON s.id = service_id
      WHERE bm.id = staff_member_id AND is_business_admin(s.business_id)
    )
  );
CREATE POLICY staff_services_delete ON staff_services FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM business_members bm
      JOIN services s ON s.id = service_id
      WHERE bm.id = staff_member_id AND is_business_admin(s.business_id)
    )
  );

-- Staff availability
CREATE POLICY staff_availability_select ON staff_availability FOR SELECT USING (true);
CREATE POLICY staff_availability_insert ON staff_availability FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members bm
      WHERE bm.id = staff_member_id AND is_business_admin(bm.business_id)
    )
  );
CREATE POLICY staff_availability_update ON staff_availability FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM business_members bm
      WHERE bm.id = staff_member_id AND is_business_admin(bm.business_id)
    )
  );
CREATE POLICY staff_availability_delete ON staff_availability FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM business_members bm
      WHERE bm.id = staff_member_id AND is_business_admin(bm.business_id)
    )
  );

-- Staff time off
CREATE POLICY staff_time_off_select ON staff_time_off FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_members bm
      WHERE bm.id = staff_member_id
        AND (bm.business_id IN (SELECT get_user_business_ids()) OR bm.is_bookable = true)
    )
  );
CREATE POLICY staff_time_off_insert ON staff_time_off FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members bm
      WHERE bm.id = staff_member_id AND is_business_admin(bm.business_id)
    )
  );
CREATE POLICY staff_time_off_delete ON staff_time_off FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM business_members bm
      WHERE bm.id = staff_member_id AND is_business_admin(bm.business_id)
    )
  );

-- Clients
CREATE POLICY clients_select ON clients FOR SELECT
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY clients_insert ON clients FOR INSERT
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY clients_update ON clients FOR UPDATE
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY clients_delete ON clients FOR DELETE
  USING (is_business_admin(business_id));

-- Appointments
CREATE POLICY appointments_select ON appointments FOR SELECT
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY appointments_insert ON appointments FOR INSERT
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY appointments_update ON appointments FOR UPDATE
  USING (business_id IN (SELECT get_user_business_ids()));
CREATE POLICY appointments_delete ON appointments FOR DELETE
  USING (is_business_admin(business_id));

-- Public booking RPC
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
