# Fix Featured Cases Schema Error

## Problem
The `purchase_case_boost` RPC function is failing with:
```
column "price_paid" of relation "featured_cases" does not exist
```

This happens because there are two different schemas for the `featured_cases` table in the codebase:
- Old schema (in `create-featured-followers-tables.sql`): uses `payment_amount`, `user_id`, `payment_id`
- New schema (expected by RPC): uses `price_paid`, `paid_by`, `stripe_payment_id`, `boost_type`

## Solution

### Step 1: Run the Migration Script
Go to your Supabase SQL Editor and run the file:
```
fix-featured-cases-schema.sql
```

This script will:
1. ✅ Detect if you have the old schema and migrate it
2. ✅ Add missing columns (`price_paid`, `boost_type`, `paid_by`, `stripe_payment_id`, `impressions`, `clicks`)
3. ✅ Copy data from old columns to new ones
4. ✅ Create the table fresh if it doesn't exist
5. ✅ Create/update the `boost_pricing` table with default tiers
6. ✅ Set up proper indexes and RLS policies

### Step 2: Verify the Schema
After running the migration, verify the table structure:

```sql
-- Check featured_cases columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'featured_cases'
ORDER BY ordinal_position;

-- Check boost_pricing data
SELECT * FROM boost_pricing ORDER BY sort_order;
```

Expected `featured_cases` columns:
- ✅ `case_id` (UUID, PRIMARY KEY)
- ✅ `featured_until` (TIMESTAMPTZ, NOT NULL)
- ✅ `price_paid` (DECIMAL, NOT NULL)
- ✅ `boost_type` (TEXT, NOT NULL)
- ✅ `paid_by` (UUID, references profiles)
- ✅ `stripe_payment_id` (TEXT, nullable)
- ✅ `status` (TEXT, default 'active')
- ✅ `impressions` (INTEGER, default 0)
- ✅ `clicks` (INTEGER, default 0)
- ✅ `created_at` (TIMESTAMPTZ)
- ✅ `updated_at` (TIMESTAMPTZ)

### Step 3: Test the Boost Purchase
After migration, test the boost purchase:

1. Try purchasing with wallet balance
2. Try purchasing with Stripe
3. Verify the case appears in featured cases
4. Check that analytics (impressions, clicks) work

### Step 4: Clean Up Old Schema Files (Optional)
Once everything works, you can update the old schema file to prevent confusion:

The file `create-featured-followers-tables.sql` should be replaced with the correct schema or removed to avoid schema conflicts in the future.

## What Was Fixed in the Code

### BoostPurchaseModal.tsx
- ✅ Fixed: Import `walletService` to get wallet balance
- ✅ Fixed: Changed from `boostService['supabase'].from('wallets')` to `walletService.getBalance(userId)`
- ✅ Fixed: Updated return type handling for `purchaseBoostWithWallet` (returns boolean)
- ✅ Fixed: Updated return type handling for `purchaseBoost` (returns `{ url: string } | null`)

## Testing Checklist

- [ ] Migration script runs without errors
- [ ] `featured_cases` table has all required columns
- [ ] `boost_pricing` table has 3 tiers (Basic, Premium, Ultra)
- [ ] Can purchase boost with wallet balance (if sufficient funds)
- [ ] Can purchase boost with Stripe (redirects to checkout)
- [ ] Featured cases appear correctly on the site
- [ ] Impressions and clicks tracking works
- [ ] No more "column does not exist" errors
