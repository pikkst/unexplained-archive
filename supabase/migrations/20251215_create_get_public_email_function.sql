-- Create function to get user's public email if they've opted to show it
CREATE OR REPLACE FUNCTION get_user_public_email(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
  show_email_flag BOOLEAN;
BEGIN
  -- Check if user wants to show email
  SELECT show_email INTO show_email_flag
  FROM profiles
  WHERE id = user_id;
  
  -- If user doesn't want to show email, return null
  IF NOT COALESCE(show_email_flag, FALSE) THEN
    RETURN NULL;
  END IF;
  
  -- Get email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id;
  
  RETURN user_email;
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION get_user_public_email(UUID) TO authenticated, anon;

-- Add comment
COMMENT ON FUNCTION get_user_public_email IS 'Returns user email only if they have opted to show it publicly via show_email flag in profiles';
