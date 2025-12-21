-- Create a function to auto-confirm user email
-- This is needed because the Supabase project has email confirmation enabled
-- and we need users to be able to login immediately after registration

CREATE OR REPLACE FUNCTION confirm_user_email(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
    UPDATE auth.users 
    SET email_confirmed_at = NOW(),
        confirmed_at = NOW(),
        updated_at = NOW()
    WHERE LOWER(email) = LOWER(user_email) 
    AND email_confirmed_at IS NULL;
END;
$$;

-- Grant execute permission to authenticated and service_role
GRANT EXECUTE ON FUNCTION confirm_user_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_user_email(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION confirm_user_email(TEXT) TO anon;
