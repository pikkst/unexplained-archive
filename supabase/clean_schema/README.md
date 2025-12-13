# Clean Schema - Database Setup

Siin kaustas on kõik vajalikud SQL skriptid, et luua andmebaas puhtalt nullist.

## Kasutamine

### 1. Kohalik Testimine

```bash
# Loo test database
createdb unexplained_archive_test

# Rakenda schema
psql -d unexplained_archive_test -f 001_golden_schema.sql
psql -d unexplained_archive_test -f 002_functions_and_triggers.sql
psql -d unexplained_archive_test -f 003_rls_policies.sql
psql -d unexplained_archive_test -f 004_seeding.sql
```

### 2. Supabase Production

Supabase Dashboard → SQL Editor → New Query

```sql
-- Käivita järjekorras:
-- 1. 001_golden_schema.sql
-- 2. 002_functions_and_triggers.sql
-- 3. 003_rls_policies.sql
-- 4. 004_seeding.sql
```

**TÄHTIS:** Ära käivita DROP SCHEMA käsku production'is!

### 3. Supabase CLI

```bash
# Link to project
supabase link --project-ref <your-project-ref>

# Apply migrations (kui need on supabase/migrations kaustas)
supabase db push

# VÕI käsitsi:
cat supabase/clean_schema/001_golden_schema.sql | supabase db execute
cat supabase/clean_schema/002_functions_and_triggers.sql | supabase db execute
cat supabase/clean_schema/003_rls_policies.sql | supabase db execute
cat supabase/clean_schema/004_seeding.sql | supabase db execute
```

## Failide Sisu

### 001_golden_schema.sql
- Kõik tabelid
- Indeksid
- Kommentaarid
- **MITTE RLS policies ega functions**

Sisaldab:
- Core tabelid (profiles, cases, wallets, transactions)
- Subscription süsteem (plans, credits, usage_log, transactions)
- Team collaboration (case_team_members, case_team_messages)
- Notifications (mass_notifications, subscription_notification_groups)
- Admin (background_checks, platform_revenue, analytics_events)

### 002_functions_and_triggers.sql
- Kõik funktsioonid
- Triggerid
- Stored procedures

Sisaldab 60+ funktsiooni:
- **User Management**: handle_new_user()
- **Subscription Management**: initialize_subscription_credits(), check_subscription_credits(), deduct_subscription_credits(), check_and_deduct_case_posting_credit(), get_my_subscription(), get_platform_subscription_stats()
- **Case Functions**: increment_case_views(), process_case_resolution(), process_voting_outcome(), admin_resolve_dispute()
- **Team Collaboration**: get_case_team(), claim_case_as_leader(), accept_team_invitation(), reject_team_invitation(), remove_team_member(), leave_team(), set_reward_split(), mark_team_messages_read()
- **Following & Notifications**: follow_case(), follow_case_guest(), unfollow_case(), send_message(), get_case_messages(), mark_message_read(), create_notification()
- **Comment & Forum**: increment_comment_likes(), increment_forum_thread_views()
- **Verification**: get_verification_status(), request_background_check()
- **Wallet Management**: process_platform_donation(), donate_from_wallet()
- **Boost Management**: apply_case_boost(), boost_case_from_wallet()
- **Admin Functions**: admin_approve_case(), is_admin()
- **Mass Notifications**: create_mass_notification(), get_subscription_group_members(), update_group_member_counts()

### 003_rls_policies.sql
- Row Level Security policies
- Storage policies

Policies kõigile tabelitele:
- Public access (cases, profiles, comments)
- User access (wallets, transactions, subscriptions)
- Admin access (notifications, revenue, analytics)
- Service role access (kõik tabelid)

### 004_seeding.sql
- Algandmed
- Test data (optional)
- Subscription plans
- Notification groups
- Boost pricing
- Platform wallet

## Versioonid

**Versioon 1.0** (2025-12-07)
- Algne clean schema

**Versioon 2.0** (2025-12-12) - **CURRENT**
- Lisatud investigator subscription süsteem
- Team collaboration funktsioonid
- Mass notification süsteem
- Kõik migration failid integreeritud

## Muudatused Migratsioonidest

Kõik järgmised migratsioonid on integreeritud:

1. ✅ `20241211_create_media_bucket.sql`
2. ✅ `20251211_add_evidence_fields.sql`
3. ✅ `20251211_add_investigator_fields.sql`
4. ✅ `20251211_add_investigator_update_policies.sql`
5. ✅ `20251211_create_team_chat.sql`
6. ✅ `20251211_create_team_collaboration.sql`
7. ✅ `20251211_ensure_assigned_investigator_fkey.sql`
8. ✅ `20251211_fix_case_status_values.sql`
9. ✅ `20251211_fix_rls_policies.sql`
10. ✅ `20251211_fix_team_members_insert.sql`
11. ✅ `20251211_fix_wallet_donation_reward_amount.sql`
12. ✅ `20251211_storage_policies.sql`
13. ✅ `20251212000001_investigator_subscriptions.sql`
14. ✅ `20251212000002_subscription_notification_groups.sql`
15. ✅ `20251212000003_translate_subscription_plans.sql`
16. ✅ `20251212000004_fix_subscriptions_rls.sql`
17. ✅ `20251212000005_add_subscription_columns.sql`
18. ✅ `20251212000006_add_cancel_column.sql`
19. ✅ `20251212_add_stripe_customer_id.sql`
20. ✅ `20251212_create_platform_donation_function.sql`
21. ✅ `20251212_fix_transactions_rls.sql`

## Testimine

Pärast schema rakendamist testi:

```sql
-- Kontrolli tabeleid
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Kontrolli funktsioone
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Kontrolli RLS policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Kontrolli subscription plans
SELECT plan_code, plan_name, price_monthly, ai_credits_monthly 
FROM subscription_plans 
ORDER BY display_order;

-- Kontrolli notification groups
SELECT group_code, group_name, member_count 
FROM subscription_notification_groups 
ORDER BY group_code;
```

## Support

Probleemide korral vaata:
- `../CLEAN_SCHEMA_UPDATE_2025-12-12.md` - Detailne dokumentatsioon
- `../migrations/` - Algse migratsioonide kaust

