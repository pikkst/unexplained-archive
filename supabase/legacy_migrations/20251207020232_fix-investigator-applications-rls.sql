-- =============================================
-- FIX INVESTIGATOR APPLICATIONS RLS
-- This ensures the table is accessible via API
-- =============================================

-- First, ensure table is in PUBLIC schema
ALTER TABLE IF EXISTS public.investigator_applications ENABLE ROW LEVEL SECURITY;

-- If table doesn't exist in public, create it
CREATE TABLE IF NOT EXISTS public.investigator_applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  motivation TEXT NOT NULL,
  expertise TEXT[] NOT NULL,
  experience TEXT,
  certifications JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.investigator_applications ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies completely
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND tablename = 'investigator_applications'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.investigator_applications', pol.policyname);
    END LOOP;
END $$;

-- Create fresh policies with correct permissions
-- Policy 1: Users can INSERT their own applications
CREATE POLICY "users_insert_own_application"
ON public.investigator_applications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 2: Users can SELECT their own applications
CREATE POLICY "users_select_own_application"
ON public.investigator_applications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 3: Admins can SELECT all applications
CREATE POLICY "admins_select_all_applications"
ON public.investigator_applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy 4: Admins can UPDATE applications
CREATE POLICY "admins_update_applications"
ON public.investigator_applications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON public.investigator_applications TO authenticated;
GRANT UPDATE ON public.investigator_applications TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verify the table is exposed via PostgREST API
SELECT 
  schemaname, 
  tablename,
  tableowner
FROM pg_tables 
WHERE tablename = 'investigator_applications';

-- List all policies on the table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'investigator_applications';

-- Check if API role has access
SELECT 
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'investigator_applications';
