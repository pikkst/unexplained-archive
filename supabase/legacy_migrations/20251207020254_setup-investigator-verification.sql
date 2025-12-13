-- =============================================
-- INVESTIGATOR VERIFICATION SYSTEM
-- Two-step verification: Email + Admin Approval
-- Run this in Supabase SQL Editor
-- =============================================

-- Add investigator-specific fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS investigator_status TEXT DEFAULT 'pending' CHECK (investigator_status IN ('pending', 'approved', 'rejected', 'suspended')),
ADD COLUMN IF NOT EXISTS investigator_bio TEXT,
ADD COLUMN IF NOT EXISTS investigator_expertise TEXT[], -- Array of expertise areas
ADD COLUMN IF NOT EXISTS investigator_certifications JSONB DEFAULT '[]'::jsonb, -- [{name, issuer, year, url}]
ADD COLUMN IF NOT EXISTS investigator_verification_notes TEXT, -- Why they want to become investigator
ADD COLUMN IF NOT EXISTS investigator_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS investigator_approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS cases_solved INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS success_rate DECIMAL(5,2) DEFAULT 0.00;

-- Create investigator applications table
CREATE TABLE IF NOT EXISTS investigator_applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  motivation TEXT NOT NULL, -- Why they want to be investigator
  expertise TEXT[] NOT NULL, -- Areas of expertise
  experience TEXT, -- Previous experience
  certifications JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS policies will be created below after indexes

-- Function to process investigator application approval
CREATE OR REPLACE FUNCTION approve_investigator_application(
  p_application_id UUID,
  p_admin_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_expertise TEXT[];
  v_certifications JSONB;
  v_motivation TEXT;
BEGIN
  -- Get application details
  SELECT user_id, expertise, certifications, motivation
  INTO v_user_id, v_expertise, v_certifications, v_motivation
  FROM investigator_applications
  WHERE id = p_application_id;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;
  
  -- Update application status
  UPDATE investigator_applications
  SET status = 'approved',
      reviewed_by = p_admin_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_application_id;
  
  -- Update profile to investigator with approved status
  UPDATE profiles
  SET role = 'investigator',
      investigator_status = 'approved',
      investigator_bio = v_motivation,
      investigator_expertise = v_expertise,
      investigator_certifications = v_certifications,
      investigator_approved_at = NOW(),
      investigator_approved_by = p_admin_id,
      updated_at = NOW()
  WHERE id = v_user_id;
  
  -- Log admin action
  INSERT INTO admin_actions (admin_id, action_type, created_at, notes)
  VALUES (p_admin_id, 'APPROVE_INVESTIGATOR', NOW(), 'Approved investigator: ' || v_user_id::text);
  
  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject investigator application
CREATE OR REPLACE FUNCTION reject_investigator_application(
  p_application_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get application user_id
  SELECT user_id INTO v_user_id
  FROM investigator_applications
  WHERE id = p_application_id;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;
  
  -- Update application status
  UPDATE investigator_applications
  SET status = 'rejected',
      reviewed_by = p_admin_id,
      reviewed_at = NOW(),
      rejection_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_application_id;
  
  -- Update profile status (keep as user but mark as rejected)
  UPDATE profiles
  SET investigator_status = 'rejected',
      updated_at = NOW()
  WHERE id = v_user_id;
  
  -- Log admin action
  INSERT INTO admin_actions (admin_id, action_type, created_at, notes)
  VALUES (p_admin_id, 'REJECT_INVESTIGATOR', NOW(), 'Rejected investigator: ' || v_user_id::text || ' - ' || p_reason);
  
  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update handle_new_user trigger to set investigator_status for new investigators
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_role TEXT;
BEGIN
  -- Generate username from email or metadata
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username', 
    split_part(NEW.email, '@', 1)
  );
  
  -- Ensure username is unique by appending random suffix if needed
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = v_username) LOOP
    v_username := split_part(NEW.email, '@', 1) || '_' || substr(md5(random()::text), 1, 6);
  END LOOP;
  
  -- Get role from metadata (defaults to 'user')
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
  
  -- Insert profile
  INSERT INTO public.profiles (
    id, 
    username, 
    full_name, 
    role, 
    investigator_status,
    avatar_url, 
    bio, 
    reputation
  )
  VALUES (
    NEW.id,
    v_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_role,
    CASE 
      WHEN v_role = 'investigator' THEN 'pending'
      ELSE NULL
    END,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    '',
    0
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    investigator_status = EXCLUDED.investigator_status,
    avatar_url = EXCLUDED.avatar_url;
  
  -- Create wallet for the user
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  RAISE LOG 'Profile created for user % with role % and status %', 
    NEW.id, 
    v_role,
    CASE WHEN v_role = 'investigator' THEN 'pending' ELSE 'N/A' END;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_investigator_applications_status ON investigator_applications(status);
CREATE INDEX IF NOT EXISTS idx_investigator_applications_user_id ON investigator_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_investigator_status ON profiles(investigator_status);

-- =============================================
-- RLS POLICIES FOR INVESTIGATOR APPLICATIONS
-- =============================================
ALTER TABLE investigator_applications ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own application" ON investigator_applications;
DROP POLICY IF EXISTS "Users can view their own application" ON investigator_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON investigator_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON investigator_applications;
DROP POLICY IF EXISTS "Users view own applications" ON investigator_applications;
DROP POLICY IF EXISTS "Users create own applications" ON investigator_applications;
DROP POLICY IF EXISTS "Admins view all applications" ON investigator_applications;
DROP POLICY IF EXISTS "Admins update applications" ON investigator_applications;

-- Policy 1: Users can insert their own application
CREATE POLICY "Users can insert their own application"
ON investigator_applications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 2: Users can view their own application
CREATE POLICY "Users can view their own application"
ON investigator_applications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 3: Admins can view all applications
CREATE POLICY "Admins can view all applications"
ON investigator_applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy 4: Admins can update applications
CREATE POLICY "Admins can update applications"
ON investigator_applications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
