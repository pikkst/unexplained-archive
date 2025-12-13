-- Add missing investigator fields to profiles table
-- Problem: investigator_status and related fields are missing from the database

-- Add investigator-specific fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS investigator_status TEXT DEFAULT 'pending' CHECK (investigator_status IN ('pending', 'approved', 'rejected', 'suspended')),
ADD COLUMN IF NOT EXISTS investigator_bio TEXT,
ADD COLUMN IF NOT EXISTS investigator_expertise TEXT[],
ADD COLUMN IF NOT EXISTS investigator_certifications JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS investigator_experience TEXT,
ADD COLUMN IF NOT EXISTS investigator_verification_notes TEXT,
ADD COLUMN IF NOT EXISTS investigator_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS investigator_approved_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS cases_solved INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS success_rate DECIMAL(5,2) DEFAULT 0.00;

-- Create index for investigator queries
CREATE INDEX IF NOT EXISTS idx_profiles_investigator_status ON public.profiles(investigator_status) WHERE role = 'investigator';

-- Auto-approve TestUurija since they are already approved by admin
UPDATE public.profiles 
SET investigator_status = 'approved',
    investigator_approved_at = NOW()
WHERE username = 'TestUurija' 
  AND role = 'investigator';

-- Verify the changes
SELECT 
    username,
    role,
    investigator_status,
    investigator_approved_at
FROM public.profiles
WHERE username = 'TestUurija';
