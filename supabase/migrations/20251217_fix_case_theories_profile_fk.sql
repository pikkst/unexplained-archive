-- Fix case_theories to reference profiles table instead of auth.users
-- This allows Supabase to automatically join with profiles table

-- Drop the old foreign key if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'case_theories_user_id_fkey' 
    AND table_name = 'case_theories'
  ) THEN
    ALTER TABLE case_theories DROP CONSTRAINT case_theories_user_id_fkey;
  END IF;
END $$;

-- Add new foreign key to profiles table
-- Since profiles.id references auth.users(id), this maintains referential integrity
ALTER TABLE case_theories 
  ADD CONSTRAINT case_theories_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE;

-- Also fix theory_votes table
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'theory_votes_user_id_fkey' 
    AND table_name = 'theory_votes'
  ) THEN
    ALTER TABLE theory_votes DROP CONSTRAINT theory_votes_user_id_fkey;
  END IF;
END $$;

ALTER TABLE theory_votes 
  ADD CONSTRAINT theory_votes_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE;
