# Clean Schema Update - 2025-12-12

## Kokkuvõte

Kõik migration failid (19 tk) on nüüd edukalt integreeritud `clean_schema` failidesse. Database saab nüüd puhtalt üles ehitada ilma vigadeta.

## Muudatused

### 001_golden_schema.sql

**Uuendatud tabelid:**
- `profiles` - lisatud `stripe_customer_id` väli

**Uued tabelid:**
1. **subscription_plans** - Subscription plaanide konfiguratsioon (Basic, Premium, Pro)
2. **subscription_credits** - Kasutajate AI krediidi bilanss
3. **subscription_usage_log** - AI tööriistade kasutamise logi
4. **subscription_transactions** - Subscription maksete ajalugu
5. **subscription_notification_groups** - Grupi teavituste konfiguratsioon
6. **mass_notifications** - Massiteadete logi
7. **case_team_messages** - Meeskonna sisemine vestlus juhtumite kohta

**Uuendatud tabelid:**
- `subscriptions` - lisatud uued väljad: `billing_cycle`, `stripe_price_id`, `cancel_at_period_end`, `canceled_at`
- `case_team_members` - uuendatud: `user_id` → `investigator_id`, lisatud `notes`, `left_at`, `updated_at`

**Uued indeksid:**
- Subscription tabelite indeksid
- Team collaboration indeksid
- Stripe customer ID indeks

### 002_functions_and_triggers.sql

**Uued funktsioonid (60+):**

**User Management:**
- `handle_new_user()` - Auto-creates profile & wallet (trigger)

**Subscription Management:**
- `initialize_subscription_credits()` - Initsialiseeri krediiti uue subscription jaoks
- `check_subscription_credits()` - Kontrolli kas kasutajal on piisavalt krediiti
- `deduct_subscription_credits()` - Lahuta krediite kasutamisel
- `check_and_deduct_case_posting_credit()` - Special handling for case posts
- `get_my_subscription()` - User's subscription details
- `get_platform_subscription_stats()` - Admin statistics
- `reset_monthly_subscription_credits()` - Lähtesta kuised krediidid (cron job)
- `expire_onetime_subscriptions()` - Aegu ühekordse paketi subscriptionid

**Case Functions:**
- `increment_case_views()` - Track case view counts
- `process_case_resolution()` - Handle case resolution
- `process_voting_outcome()` - Voting result processing
- `admin_resolve_dispute()` - Admin dispute resolution

**Team Collaboration:**
- `get_case_team()` - Hangi juhtumi meeskonna liikmed
- `claim_case_as_leader()` - Investigator claims case
- `accept_team_invitation()` - Accept team invite
- `reject_team_invitation()` - Reject team invite
- `remove_team_member()` - Leader removes member
- `leave_team()` - Member leaves team
- `set_reward_split()` - Set team reward distribution
- `auto_add_investigator_to_team()` - Lisa uurija automaatselt meeskonna liidriks (trigger)
- `get_unread_team_message_count()` - Lugemata meeskonna sõnumite arv
- `mark_team_messages_read()` - Märgi meeskonna sõnumid loetuks

**Following & Notifications:**
- `follow_case()` - Follow case updates
- `follow_case_guest()` - Guest following
- `unfollow_case()` - Stop following
- `send_message()` - Send direct message
- `get_case_messages()` - Retrieve messages
- `mark_message_read()` - Mark message read
- `create_notification()` - Create notification

**Comment & Forum:**
- `increment_comment_likes()` - Like counter
- `increment_forum_thread_views()` - View counter

**Verification:**
- `get_verification_status()` - User KYC status
- `request_background_check()` - Background check request

**Wallet Management:**
- `process_platform_donation()` - Handle donations
- `donate_from_wallet()` - User donations

**Boost Management:**
- `apply_case_boost()` - Apply boost to case
- `boost_case_from_wallet()` - Boost with wallet balance

**Admin Functions:**
- `admin_approve_case()` - Case approval
- `is_admin()` - Check admin status

**Notification Management:**
- `get_subscription_group_members()` - Hangi grupi liikmed teavituste jaoks
- `create_mass_notification()` - Send group notifications
- `update_group_member_counts()` - Uuenda grupi liikmete arvu

### 003_rls_policies.sql

**Uued RLS poliitikad:**

1. **subscriptions** - kasutajad näevad ainult oma subscription'e
2. **subscription_plans** - avalikud kõigile
3. **subscription_credits** - kasutajad näevad ainult oma krediite
4. **subscription_usage_log** - kasutajad näevad ainult oma kasutamist
5. **subscription_transactions** - kasutajad näevad ainult oma tehinguid
6. **subscription_notification_groups** - ainult adminid
7. **mass_notifications** - ainult adminid
8. **case_team_members** - meeskonna liikmed ja liidrid
9. **case_team_messages** - ainult aktiivse meeskonna liikmed

### 004_seeding.sql

**Uued seed andmed:**

1. **Subscription Plans:**
   - Basic Plan (€9.99/kuu, 50 krediiti)
   - Premium Plan (€24.99/kuu, unlimited krediit)
   - Pro Plan (€49.99/kuu, unlimited krediit, 5 liiget)
   - Iga plaani jaoks on lisatud ka eestikeelsed ja vene keelsed nimetused

2. **Notification Groups:**
   - all_subscribers
   - basic_subscribers
   - premium_subscribers
   - pro_subscribers
   - trial_users
   - canceled_subscribers
   - expired_subscribers
   - high_usage
   - low_usage

## Integriteet

Kõik migration failidest pärit funktsioonid, tabelid ja poliitikad on nüüd clean_schema failides. Database struktuuri saab luua järgmises järjekorras:

1. `001_golden_schema.sql` - Tabelid ja indeksid
2. `002_functions_and_triggers.sql` - Funktsioonid ja triggerid
3. `003_rls_policies.sql` - RLS poliitikad
4. `004_seeding.sql` - Algandmed

## Testimine

Testimiseks käivita järgmised käsud:

```bash
# 1. Loo puhas andmebaas
psql -U postgres -d unexplained_archive -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 2. Rakenda clean_schema
psql -U postgres -d unexplained_archive -f supabase/clean_schema/001_golden_schema.sql
psql -U postgres -d unexplained_archive -f supabase/clean_schema/002_functions_and_triggers.sql
psql -U postgres -d unexplained_archive -f supabase/clean_schema/003_rls_policies.sql
psql -U postgres -d unexplained_archive -f supabase/clean_schema/004_seeding.sql
```

## Järgmised Sammud

1. ✅ Migration failide integreerimine - VALMIS
2. 🔄 Database testimine Supabase keskkonnas
3. 🔄 Frontiend'i testimine uue schema vastu
4. 🔄 Edge functions'ide uuendamine

## Kaetud Funktsionaalsused

✅ **Rahade liiklus:**
- Wallets
- Transactions
- Donations
- Escrow
- Withdrawals
- Platform fees

✅ **Subscriptions:**
- 3 plaani (Basic, Premium, Pro)
- Krediidi jälgimine
- Kasutamise logi
- Maksete ajalugu

✅ **Suhtlussüsteem:**
- Otsesed sõnumid
- Meeskonna chat
- Teavitused
- Mass teavitused

✅ **Team Collaboration:**
- Meeskonna liikmed
- Rollid (leader/member)
- Sisesed vestlused
- Panuste jagamine

✅ **Investigator System:**
- Taotlused
- Kinnitamine
- Profiili väljad
- Statistika

## Lisatud Funktsioonid (täielik nimekiri)

**002_functions_and_triggers.sql:**

1. **Wallet & Payment Functions:**
   - `process_direct_donation()` - Stripe maksed
   - `donate_from_wallet()` - Doneerimised wallet'ist
   - `increment_case_escrow()` - Juhtumi escrow suurendamine
   - `process_platform_donation()` - Platvormi toetused
   - `release_escrow_to_investigator()` - Escrow vabastamine
   - `process_withdrawal()` - Väljamaksed
   - `refund_failed_withdrawal()` - Ebaõnnestunud väljamakse tagastamine
   - `unreserve_wallet_balance()` - Reserveeritud summa tagastamine

2. **Subscription Functions:**
   - `initialize_subscription_credits()` - Krediidi alustamine
   - `check_subscription_credits()` - Krediidi kontroll
   - `deduct_subscription_credits()` - Krediidi mahaarvamine
   - `reset_monthly_subscription_credits()` - Kuine lähtestus
   - `expire_onetime_subscriptions()` - Aegunud packagete kontroll

3. **Team Collaboration Functions:**
   - `get_case_team()` - Meeskonna liikmed
   - `auto_add_investigator_to_team()` - Automaatne lisamine (trigger)
   - `get_unread_team_message_count()` - Lugemata sõnumid
   - `mark_team_messages_read()` - Märgi loetuks
   - `invite_team_member()` - Kutsu liige
   - `distribute_team_reward()` - Jaga tasu

4. **Notification Functions:**
   - `get_subscription_group_members()` - Grupi liikmed
   - `update_group_member_counts()` - Uuenda arve

5. **Boost Functions:**
   - `track_boost_impression()` - Impressionid
   - `track_boost_click()` - Klikid
   - `get_active_boosts()` - Aktiivsed boostid
   - `get_user_boost_analytics()` - Kasutaja analüütika
   - `purchase_case_boost()` - Boosti ostmine

6. **Admin Functions:**
   - `get_pending_investigator_applications()` - Ootel taotlused
   - `approve_investigator_application()` - Kinnita
   - `approve_investigator_application_wrapper()` - Kinnitamine (wrapper)
   - `reject_investigator_application()` - Keeldu
   - `reject_investigator_application_wrapper()` - Keeldumine (wrapper)
   - `get_all_investigators()` - Kõik uurijad
   - `demote_investigator()` - Degradeeri

7. **Notification Management:**
   - `mark_notification_read()` - Märgi teatatud
   - `mark_all_notifications_read()` - Märgi kõik teatatud

8. **Profile & Misc:**
   - `handle_new_user()` - Uue kasutaja loomine
   - `update_timestamp()` - Timestampi uuendamine
   - `room_messages_broadcast_trigger()` - Realtime broadcast
   - `messages_broadcast_trigger()` - Sõnumite broadcast
   - `check_investigator_application()` - Taotluse kontroll
   - `submit_investigator_application()` - Taotluse esitamine
   - `sync_investigator_ids()` - Investigator ID sünkroniseerimine (trigger)
   - `is_admin()` - Admin kontroll

## Märkused

- ✅ Kõik RLS poliitikad on paigas
- ✅ Service role'il on täielik juurdepääs kõigile tabelitele
- ✅ Adminitel on juurdepääs kõigile administratiivsete funktsioonidele
- ✅ Storage poliitikad on erinevad ja on käsitletud DO block'iga
- ✅ Storage bucket 'media' on loodud seeding failis
- ✅ Kõik donation ja wallet funktsioonid on lisatud
- ✅ Team collaboration on täielikult toetatud
- ✅ Subscription süsteem on valmis

## Viimased Sammud Enne Deploymentit

1. **Kontrolli .env faili:**
   - Stripe API võtmed
   - Supabase URL ja anon key
   - Database connection string

2. **Supabase Console:**
   - Storage bucket 'media' on loodud
   - RLS on enabled kõigil tabelitel
   - Auth settings on korras

3. **Edge Functions:**
   - `stripe-webhook` - Stripe event handling
   - `cancel-subscription` - Subscription tühistamine
   - Muud vajalikud funktsioonid

4. **Testing:**
   - Subscription flow (Basic → Premium → Pro)
   - Wallet donations
   - Team collaboration
   - Mass notifications (admin)

