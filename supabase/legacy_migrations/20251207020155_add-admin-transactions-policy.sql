-- Add RLS policy for admins to view all transactions
-- Run this in Supabase SQL Editor

-- Allow admins to view all transactions
CREATE POLICY "Admins view all transactions" ON transactions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Allow admins to view all wallets
CREATE POLICY "Admins view all wallets" ON wallets 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
