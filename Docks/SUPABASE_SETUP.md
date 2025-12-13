# Unexplained Archive - Supabase Setup Guide

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose organization and set:
   - **Project Name**: unexplained-archive
   - **Database Password**: (save this securely!)
   - **Region**: Choose closest to your users
4. Wait for project to initialize (~2 minutes)

## Step 2: Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** > **API**
2. Copy these values:
   - **Project URL**: (looks like `https://xxxxx.supabase.co`)
   - **anon/public key**: (long JWT token)

## Step 3: Setup Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy all contents from `supabase-schema.sql` file
4. Click **Run** to execute the SQL
5. Verify tables were created in **Database** > **Tables**

## Step 4: Setup Storage

1. Go to **Storage** in Supabase dashboard
2. Click **New Bucket**
3. Create bucket:
   - **Name**: `media`
   - **Public**: ✅ Enable (so images are publicly accessible)
   - **File size limit**: 50 MB
   - **Allowed MIME types**: `image/*,video/*`
4. Click **Create Bucket**

## Step 5: Configure Storage Policies

1. Click on the `media` bucket
2. Go to **Policies** tab
3. Add these policies:

**Policy 1: Public Read Access**
```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media');
```

**Policy 2: Authenticated Upload**
```sql
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media');
```

**Policy 3: Users can delete own files**
```sql
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## Step 6: Setup Authentication

1. Go to **Authentication** > **Providers**
2. Enable **Email** provider (already enabled by default)
3. Optional: Enable social providers (Google, GitHub, etc.)

**Configure Email Templates** (optional):
1. Go to **Authentication** > **Email Templates**
2. Customize confirmation and reset password emails

## Step 7: Configure Environment Variables

1. In your project root, create `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_HUGGING_FACE_API_KEY=your-hf-api-key-here
```

2. Get Hugging Face API key:
   - Go to [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
   - Create new token with "Read" access
   - Copy token to `.env`

## Step 8: Test Connection

Run the development server:
```bash
npm run dev
```

Try to:
1. Register a new account
2. Login
3. Check if profile was created in Supabase

## Troubleshooting

### Can't connect to Supabase
- Check if project is fully initialized
- Verify API keys are correct in `.env`
- Make sure `.env` file is in project root

### Can't create users
- Check if email provider is enabled
- Verify RLS policies are created
- Check browser console for errors

### Can't upload files
- Verify storage bucket is created
- Check storage policies are applied
- Make sure bucket is set to public

### Database errors
- Ensure all SQL from `supabase-schema.sql` ran successfully
- Check for errors in SQL Editor
- Verify all tables exist in Database > Tables

## Next Steps

Once Supabase is configured:
1. ✅ Database schema created
2. ✅ Storage bucket configured
3. ✅ Authentication enabled
4. ✅ Environment variables set

You're ready to run the application!

## Optional: Create Admin User

After registering your first account, make it admin:

1. Go to **Authentication** > **Users** in Supabase
2. Copy your User ID
3. Go to **SQL Editor** and run:

```sql
UPDATE profiles 
SET role = 'admin', reputation = 1000
WHERE id = 'your-user-id-here';
```

Now you have admin access in the application!
