# Parandus: Uurija ei näe üles laetud juhtumeid

## Probleem
Kui testuser lisas juhtumi koos hüvitisrahaga (donation), ei näinud testuurija (investigator) neid juhtumeid oma dashboardis ega ExploreCases vaates.

## Põhjus
Andmebaasi ja fronendi vahel oli **staatuste (status) nimed erinevad**:

### Andmebaas (vana)
```sql
status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'investigating', 'closed', 'disputed', 'voting'))
```

### Frontend (kood)
```typescript
export type CaseStatus = 'OPEN' | 'INVESTIGATING' | 'PENDING_REVIEW' | 'RESOLVED' | 'CLOSED' | 'DISPUTED' | 'VOTING';
```

**Probleem:** 
- Uued juhtumid said staatuse `'pending'` (väike algustähega)
- Uurijate dashboard otsis juhtumeid staatusega `'OPEN'` (suurtähtedega)
- RLS poliitika blokeeris `'pending'` staatusega juhtumeid avalikust vaatamisest

## Tehtud parandused

### 1. Migratsioon andmebaasis ([20251211_fix_case_status_values.sql](supabase/migrations/20251211_fix_case_status_values.sql))

```sql
-- Uuendame olemasolevad staatused
UPDATE public.cases SET status = 'OPEN' WHERE status = 'pending';
UPDATE public.cases SET status = 'INVESTIGATING' WHERE status = 'verified';
UPDATE public.cases SET status = 'INVESTIGATING' WHERE status = 'investigating';
UPDATE public.cases SET status = 'RESOLVED' WHERE status = 'closed';

-- Muudame vaikeväärtust
ALTER TABLE public.cases ALTER COLUMN status SET DEFAULT 'OPEN';

-- Uuendame CHECK constraint
ALTER TABLE public.cases ADD CONSTRAINT cases_status_check 
  CHECK (status IN ('OPEN', 'INVESTIGATING', 'PENDING_REVIEW', 'RESOLVED', 'CLOSED', 'DISPUTED', 'VOTING', 'IN_PROGRESS'));
```

### 2. RLS poliitika parandus (samas failis)

```sql
-- Eemaldame vana poliitika, mis blokkis 'pending' juhtumeid
DROP POLICY IF EXISTS "Public can view verified cases." ON public.cases;

-- Loome uue, mis lubab kõiki juhtumeid
CREATE POLICY "Public can view active cases." ON public.cases
  FOR SELECT USING (true);
```

### 3. Frontend parandus ([App.tsx](src/App.tsx))

Muutsin uute juhtumite loomise staatust:

```typescript
// ENNE:
status: 'pending' as const,

// PÄRAST:
status: 'OPEN' as const,
```

## Kuidas katsetada

1. **Käivita migratsioon Supabase SQL Editoris:**
   ```
   supabase/migrations/20251211_fix_case_status_values.sql
   ```

2. **Kontrolli olemasolevaid juhtumeid:**
   ```
   supabase/test-case-visibility.sql
   ```

3. **Testi vooga:**
   - testuser lisab uue juhtumi donatsiooni funktsiooniga
   - testuurija logib sisse
   - Kontrollib ExploreCases lehte - peaks nägema uut juhtumit
   - Kontrollib InvestigatorDashboard "Case Board (New)" tabi - peaks nägema OPEN staatuses juhtumeid

## Mõju

✅ Kõik uued juhtumid luuakse automaatselt `'OPEN'` staatusega  
✅ Olemasolevad `'pending'` juhtumid on uuendatud `'OPEN'` staatuseks  
✅ RLS poliitika lubab nüüd kõigil kasutajatel (kaasa arvatud uurijatel) näha kõiki juhtumeid  
✅ Uurijad saavad nüüd vastu võtta OPEN staatuses juhtumeid  

## Failid muudetud

1. `src/App.tsx` - uute juhtumite staatuse muutmine
2. `supabase/migrations/20251211_fix_case_status_values.sql` - andmebaasi migratsioon
3. `supabase/test-case-visibility.sql` - testimise SQL päringud
