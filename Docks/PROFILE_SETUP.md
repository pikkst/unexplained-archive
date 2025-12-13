# Profiili Muutmise Funktsiooni Seadistamine

## 1. Andmebaasi Migreerimine

Käivita Supabase SQL Editor'is järgmine SQL skript:

```bash
psql -h <your-supabase-url> -U postgres -d postgres -f add-profile-fields.sql
```

Või kopeeri `add-profile-fields.sql` sisu Supabase Dashboard → SQL Editor'i ja käivita.

## 2. Storage Bucket Seadistamine

### Automaatne viis (SQL kaudu):

SQL Editor'is käivita:
```sql
-- Create media bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  52428800, -- 50MB
  ARRAY['image/*', 'video/*']
)
ON CONFLICT (id) DO NOTHING;
```

### Manuaalne viis (Dashboard kaudu):

1. Mine Supabase Dashboard → **Storage**
2. Kliki **"New bucket"**
3. Seadista järgmised väärtused:
   - **Name:** `media`
   - **Public bucket:** ✅ (märgitud)
   - **File size limit:** `50 MB`
   - **Allowed MIME types:** `image/*`, `video/*`
4. Kliki **"Create bucket"**

## 3. Storage Policies Seadistamine

Käivita Supabase SQL Editor'is (juba kaasatud `add-profile-fields.sql` failis):

```sql
-- Allow authenticated users to upload
CREATE POLICY "Users can upload their own media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media' AND 
  (storage.foldername(name))[1] = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow public read access
CREATE POLICY "Public media access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media');

-- Allow users to update their own files
CREATE POLICY "Users can update their own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media' AND 
  (storage.foldername(name))[1] = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'media' AND 
  (storage.foldername(name))[1] = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[2]
);
```

## 4. Testimine

### Testimiseks:

1. **Käivita rakendus:**
   ```bash
   npm run dev
   ```

2. **Logi sisse** oma kasutajaga

3. **Mine profiili lehele:** `/profile`

4. **Kliki "Edit Profile"** nuppu

5. **Testi järgmisi funktsioone:**
   - ✅ Profiilipildi üleslaadimine (JPG, PNG, GIF)
   - ✅ Kasutajanime muutmine
   - ✅ Täisnime lisamine
   - ✅ Bio teksti lisamine (max 500 tähemärki)
   - ✅ Asukoha lisamine
   - ✅ Veebilehe URL-i lisamine
   - ✅ Muudatuste salvestamine

## 5. Funktsioonid

### Profiili muutmise modal sisaldab:

- **Profiilipilt:** Drag & drop või kliki üleslaadimine
- **Username:** Unikaalne kasutajanimi
- **Full Name:** Täisnimi
- **Bio:** Lühike kirjeldus (max 500 tähemärki)
- **Location:** Asukoht
- **Website:** Isiklik veebileht

### Validatsioonid:

- ✅ Pildifailid ainult (JPG, PNG, GIF)
- ✅ Maksimaalne failisuurus: 5MB
- ✅ Bio max 500 tähemärki
- ✅ Website peab olema korrektne URL

### Error Handling:

- ❌ Liiga suur fail → "Image must be less than 5MB"
- ❌ Vale failitüüp → "Please select an image file"
- ❌ Upload ebaõnnestub → "Failed to upload image"
- ❌ Profiili uuendamine ebaõnnestub → "Failed to update profile"

### Success State:

- ✅ Näitab "Profile updated successfully!" teadet
- ✅ Sulgeb modaali automaatselt pärast 1.5 sekundit
- ✅ Uuendab profiili andmeid kohe

## 6. Veaotsing

### Kui pildid ei laadi üles:

1. **Kontrolli Storage bucket'i:**
   ```sql
   SELECT * FROM storage.buckets WHERE id = 'media';
   ```

2. **Kontrolli policies:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'objects';
   ```

3. **Vaata browser console'i** (F12) veateadete jaoks

### Kui profiil ei uuendu:

1. **Kontrolli RLS policies:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```

2. **Testi updateProfile funktsiooni:**
   ```javascript
   const { error } = await updateProfile({ full_name: 'Test Name' });
   console.log(error);
   ```

## 7. TypeScript Tüübid

Profiles tabel peaks sisaldama järgmisi välju:

```typescript
interface Profile {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  website?: string;
  role: 'user' | 'investigator' | 'admin';
  reputation: number;
  created_at: string;
  updated_at: string;
}
```

## 8. Turvalisus

- ✅ RLS (Row Level Security) on lubatud
- ✅ Kasutajad saavad muuta ainult oma profiili
- ✅ Pildid laaditakse kasutaja-spetsiifilisse kausta (`avatars/{user_id}/`)
- ✅ Ainult autenditud kasutajad saavad üles laadida
- ✅ Kõik saavad vaadata profiilipilte (public read)

---

**Küsimuste korral:** Vaata `EditProfileModal.tsx` ja `AuthContext.tsx` faile.
