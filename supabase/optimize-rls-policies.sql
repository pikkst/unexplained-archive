-- Optimize RLS Policies for Performance
-- Replace auth.uid() with (select auth.uid()) to prevent re-evaluation per row
-- This is a critical performance optimization for large tables

--------------------------------------------------------------------------------
-- Table: profiles - Optimized policies
--------------------------------------------------------------------------------

-- Drop existing policies
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;

-- Recreate with optimized auth.uid() calls
CREATE POLICY "Users can update their own profile." ON public.profiles
  FOR UPDATE USING ((select auth.uid()) = id);
  
CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK ((select auth.uid()) = id);

--------------------------------------------------------------------------------
-- Table: cases - Optimized policies
--------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their own unverified cases." ON public.cases;
DROP POLICY IF EXISTS "Authenticated users can create cases." ON public.cases;
DROP POLICY IF EXISTS "Case owner or admin can update." ON public.cases;
DROP POLICY IF EXISTS "Case owner or admin can delete." ON public.cases;

CREATE POLICY "Users can view their own unverified cases." ON public.cases
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Authenticated users can create cases." ON public.cases
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Case owner or admin can update." ON public.cases
  FOR UPDATE USING ((select auth.uid()) = user_id OR is_admin((select auth.uid())));

CREATE POLICY "Case owner or admin can delete." ON public.cases
  FOR DELETE USING ((select auth.uid()) = user_id OR is_admin((select auth.uid())));

--------------------------------------------------------------------------------
-- Table: wallets - Optimized policies
--------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their own wallet." ON public.wallets;
DROP POLICY IF EXISTS "Admins can view all wallets." ON public.wallets;

CREATE POLICY "Users can view their own wallet." ON public.wallets
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can view all wallets." ON public.wallets
  FOR SELECT USING (is_admin((select auth.uid())));

--------------------------------------------------------------------------------
-- Table: transactions - Optimized policies
--------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their own transactions." ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions." ON public.transactions;

CREATE POLICY "Users can view their own transactions." ON public.transactions
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can view all transactions." ON public.transactions
  FOR SELECT USING (is_admin((select auth.uid())));

--------------------------------------------------------------------------------
-- Table: investigator_applications - Optimized policies
--------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their own applications." ON public.investigator_applications;
DROP POLICY IF EXISTS "Users can submit applications." ON public.investigator_applications;
DROP POLICY IF EXISTS "Users can update their pending applications." ON public.investigator_applications;
DROP POLICY IF EXISTS "Admins can view all applications." ON public.investigator_applications;
DROP POLICY IF EXISTS "Admins can update applications." ON public.investigator_applications;

CREATE POLICY "Users can view their own applications." ON public.investigator_applications
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can submit applications." ON public.investigator_applications
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their pending applications." ON public.investigator_applications
  FOR UPDATE USING ((select auth.uid()) = user_id AND status = 'pending');

CREATE POLICY "Admins can view all applications." ON public.investigator_applications
  FOR SELECT USING (is_admin((select auth.uid())));

CREATE POLICY "Admins can update applications." ON public.investigator_applications
  FOR UPDATE USING (is_admin((select auth.uid())));

--------------------------------------------------------------------------------
-- Table: messages - Optimized policies
--------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view messages sent to them." ON public.messages;
DROP POLICY IF EXISTS "Users can view messages they sent." ON public.messages;
DROP POLICY IF EXISTS "Users can send messages." ON public.messages;
DROP POLICY IF EXISTS "Users can update their received messages." ON public.messages;

CREATE POLICY "Users can view messages sent to them." ON public.messages
  FOR SELECT USING ((select auth.uid()) = receiver_id);

CREATE POLICY "Users can view messages they sent." ON public.messages
  FOR SELECT USING ((select auth.uid()) = sender_id);

CREATE POLICY "Users can send messages." ON public.messages
  FOR INSERT WITH CHECK ((select auth.uid()) = sender_id);

CREATE POLICY "Users can update their received messages." ON public.messages
  FOR UPDATE USING ((select auth.uid()) = receiver_id);

--------------------------------------------------------------------------------
-- Table: notifications - Optimized policies
--------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their own notifications." ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications." ON public.notifications;

CREATE POLICY "Users can view their own notifications." ON public.notifications
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own notifications." ON public.notifications
  FOR UPDATE USING ((select auth.uid()) = user_id);

--------------------------------------------------------------------------------
-- Success message
--------------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies optimized successfully!';
  RAISE NOTICE 'Performance improvement: auth.uid() is now evaluated once per query instead of per row.';
END $$;
