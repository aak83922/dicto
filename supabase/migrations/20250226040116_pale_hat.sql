/*
  # Update user handling function

  1. Changes
    - Improve handle_new_user() function to generate a default username
    - Add better error handling for missing metadata
    - Ensure unique usernames by adding a random suffix

  2. Security
    - Maintains existing RLS policies
    - Function remains security definer
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  username_base TEXT;
  username_final TEXT;
  counter INT := 0;
BEGIN
  -- Get base username from email or generate one
  username_base := COALESCE(
    new.raw_user_meta_data->>'username',
    SPLIT_PART(new.email, '@', 1)
  );

  -- Generate unique username
  LOOP
    IF counter = 0 THEN
      username_final := username_base;
    ELSE
      username_final := username_base || counter;
    END IF;

    -- Exit loop if username is unique
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE username = username_final
    );

    counter := counter + 1;
  END LOOP;

  -- Insert new profile
  INSERT INTO public.profiles (
    id,
    username,
    avatar_url,
    created_at
  ) VALUES (
    new.id,
    username_final,
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    now()
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;