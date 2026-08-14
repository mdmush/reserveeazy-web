-- Teacher invite flow: admin sets an email on a staff row; when someone signs
-- up with that email, the new auth user is linked to the waiting staff row(s).
-- Safe because Supabase email confirmation proves address ownership before a
-- session exists, and UNIQUE(business_id, user_id) prevents duplicates.
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

  UPDATE business_members
     SET user_id = NEW.id
   WHERE user_id IS NULL
     AND email IS NOT NULL
     AND lower(email) = lower(NEW.email);

  RETURN NEW;
END;
$$;
