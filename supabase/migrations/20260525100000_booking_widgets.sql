-- Embeddable booking widgets for third-party websites

CREATE TYPE widget_position AS ENUM (
  'bottom_right',
  'bottom_left',
  'bottom_center',
  'top_right',
  'top_left'
);

CREATE TABLE booking_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  position widget_position NOT NULL DEFAULT 'bottom_right',
  button_label TEXT NOT NULL DEFAULT 'Book now',
  allowed_domains TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX booking_widgets_business_idx ON booking_widgets(business_id);
CREATE INDEX booking_widgets_token_idx ON booking_widgets(public_token);

CREATE OR REPLACE FUNCTION set_booking_widgets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER booking_widgets_updated_at
  BEFORE UPDATE ON booking_widgets
  FOR EACH ROW EXECUTE FUNCTION set_booking_widgets_updated_at();

CREATE OR REPLACE FUNCTION get_embed_widget_context(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'widget_id', w.id,
    'position', w.position,
    'button_label', w.button_label,
    'allowed_domains', w.allowed_domains,
    'business_id', b.id,
    'business_slug', b.slug,
    'business_name', b.name,
    'timezone', b.timezone
  ) INTO result
  FROM booking_widgets w
  JOIN businesses b ON b.id = w.business_id
  WHERE w.public_token = p_token AND w.is_active = true;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Widget not found or inactive';
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_embed_widget_context(TEXT) TO anon, authenticated;

ALTER TABLE booking_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY widgets_select_admin ON booking_widgets
  FOR SELECT TO authenticated
  USING (is_business_admin(business_id) OR is_superuser());

CREATE POLICY widgets_insert_admin ON booking_widgets
  FOR INSERT TO authenticated
  WITH CHECK (is_business_admin(business_id));

CREATE POLICY widgets_update_admin ON booking_widgets
  FOR UPDATE TO authenticated
  USING (is_business_admin(business_id));

CREATE POLICY widgets_delete_admin ON booking_widgets
  FOR DELETE TO authenticated
  USING (is_business_admin(business_id));
