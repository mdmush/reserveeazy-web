-- Invite-link hardening: if two staff rows share an email (data entry mishap),
-- the naive UPDATE would link both and trip UNIQUE(business_id, user_id),
-- failing the signup itself. Link at most one row per business (oldest first),
-- skip businesses the user already belongs to, and never let a linking error
-- block account creation.
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

  BEGIN
    UPDATE business_members bm
       SET user_id = NEW.id
     WHERE bm.id IN (
       SELECT DISTINCT ON (m.business_id) m.id
         FROM business_members m
        WHERE m.user_id IS NULL
          AND m.email IS NOT NULL
          AND lower(m.email) = lower(NEW.email)
          AND m.business_id NOT IN (
            SELECT business_id FROM business_members WHERE user_id = NEW.id
          )
        ORDER BY m.business_id, m.created_at ASC
     );
  EXCEPTION WHEN OTHERS THEN
    -- Best-effort linking: a bad staff row must never block signup.
    NULL;
  END;

  RETURN NEW;
END;
$$;
