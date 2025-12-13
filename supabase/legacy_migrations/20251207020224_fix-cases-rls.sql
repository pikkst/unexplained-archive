-- Fix RLS policies for cases table
-- Run this in Supabase SQL Editor

-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Cases are viewable by everyone" ON cases;
DROP POLICY IF EXISTS "Authenticated users can create cases" ON cases;
DROP POLICY IF EXISTS "Users can update own cases" ON cases;
DROP POLICY IF EXISTS "Users can delete own cases" ON cases;

-- Enable RLS on cases table
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- Create policies for cases
CREATE POLICY "Cases are viewable by everyone" 
  ON cases FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can create cases" 
  ON cases FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cases" 
  ON cases FOR UPDATE 
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('investigator', 'admin')
    )
  );

CREATE POLICY "Users can delete own cases" 
  ON cases FOR DELETE 
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Verify policies are created
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'cases';
