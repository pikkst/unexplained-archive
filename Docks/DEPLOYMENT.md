# Unexplained Archive - Deployment Guide

## GitHub Pages Deployment

### Prerequisites
1. GitHub account
2. Supabase account (free tier works)
3. Google Gemini API key (for AI image generation)

### Step 1: Setup Supabase

Follow the instructions in `SUPABASE_SETUP.md` to:
1. Create Supabase project
2. Run database schema
3. Setup storage
4. Get API keys

### Step 2: Prepare GitHub Repository

1. Create new repository on GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/unexplained-archive.git
git push -u origin main
```

2. Go to repository **Settings** > **Secrets and variables** > **Actions**

3. Add these secrets:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon/public key
   - `VITE_GEMINI_API_KEY`: Your Google Gemini API key (get from https://makersuite.google.com/app/apikey)

### Step 3: Enable GitHub Pages

1. Go to repository **Settings** > **Pages**
2. Under "Build and deployment":
   - Source: **GitHub Actions**
3. Save

### Step 4: Deploy

Push to main branch to trigger deployment:
```bash
git push origin main
```

The GitHub Action will:
1. Install dependencies
2. Build the project
3. Deploy to GitHub Pages

Your site will be available at: `https://YOUR_USERNAME.github.io/unexplained-archive/`

### Step 5: Configure Custom Domain (Optional)

1. Buy a domain (e.g., from Namecheap, Google Domains)
2. In repository **Settings** > **Pages**:
   - Add custom domain: `yourdomain.com`
3. Add DNS records at your domain provider:
   ```
   Type: A
   Name: @
   Value: 185.199.108.153
   
   Type: A
   Name: @
   Value: 185.199.109.153
   
   Type: A
   Name: @
   Value: 185.199.110.153
   
   Type: A
   Name: @
   Value: 185.199.111.153
   
   Type: CNAME
   Name: www
   Value: YOUR_USERNAME.github.io
   ```
4. Enable "Enforce HTTPS" in GitHub Pages settings

### Troubleshooting

#### Build fails
- Check GitHub Actions tab for error logs
- Verify all secrets are set correctly
- Make sure `package.json` has correct scripts

#### Blank page after deployment
- Check browser console for errors
- Verify `base` in `vite.config.ts` is set to `./`
- Check if environment variables are loaded

#### Authentication not working
- Verify Supabase URL and keys are correct
- Check Supabase dashboard for authentication errors
- Ensure email provider is enabled in Supabase

#### Images not uploading
- Check storage bucket is created and public
- Verify storage policies are applied
- Check file size limits

### Local Development

Run locally before deploying:
```bash
# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env

# Add your API keys to .env

# Start development server
npm run dev

# Build for production (test)
npm run build

# Preview production build
npm run preview
```

### Updating the Site

After making changes:
```bash
git add .
git commit -m "Your commit message"
git push origin main
```

GitHub Actions will automatically rebuild and deploy.

### Performance Optimization

The build is optimized with:
- Code splitting (React, Supabase, Maps in separate chunks)
- Tree shaking (removes unused code)
- Minification
- Asset optimization

### Security Notes

- Never commit `.env` file
- Use environment variables for all secrets
- Keep Supabase Row Level Security (RLS) enabled
- Validate all user inputs
- Rate limit API calls

### Cost Estimate

- **GitHub Pages**: Free
- **Supabase**: Free tier (500MB database, 1GB file storage, 50k monthly active users)
- **Hugging Face**: Free tier (rate limited)

For production with more users, consider upgrading Supabase plan.

### Support

If issues persist:
1. Check GitHub Actions logs
2. Review browser console errors
3. Check Supabase logs
4. Test locally first

---

## Alternative Deployment Options

### Vercel (Recommended for production)
```bash
npm i -g vercel
vercel
```

### Netlify
```bash
npm i -g netlify-cli
netlify deploy
```

### Your Own Server
```bash
npm run build
# Copy dist/ folder to your web server
```

---

Your Unexplained Archive is now live! 🚀
