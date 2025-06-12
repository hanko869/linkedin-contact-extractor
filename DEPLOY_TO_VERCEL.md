# Deploy to Vercel - Step by Step Guide

## Prerequisites
- Vercel account (free at https://vercel.com)
- Git repository (GitHub, GitLab, or Bitbucket)

## Method 1: Deploy with Vercel CLI (Recommended)

### Step 1: Install Vercel CLI
```bash
npm i -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```

### Step 3: Deploy
Run this command in the project directory:
```bash
vercel
```

### Step 4: Configure Environment Variables
When prompted or after deployment, set these environment variables:

1. Go to your project on https://vercel.com
2. Navigate to Settings → Environment Variables
3. Add these variables:

```
WIZA_API_KEY=c951d1f0b91ab7e5afe187fa747f3668524ad5e2eba2c68a912654b43682cab8
NEXT_PUBLIC_SUPABASE_URL=https://rnelxyjhdlklmbhlzcou.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4eWpoZGxrbG1iaGx6Y291Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NDkzNTIsImV4cCI6MjA2NTMyNTM1Mn0.P7FHDMekLm49KWueI2TSvS0q5KjqHOLLppbqUX37ews
JWT_SECRET=bd91a7cd5343787681e5d2a78b14a07f80247376997514e817398ad5dc30a4deeac47bef98e1d4939ba4967af548e5c75d1d124a7e7b3071d763c138fb83e6c7
```

### Step 5: Redeploy
After adding environment variables, redeploy:
```bash
vercel --prod
```

## Method 2: Deploy via GitHub

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Import to Vercel
1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your repository
4. Configure project:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: `.next`

### Step 3: Add Environment Variables
Before clicking "Deploy", add these environment variables:

| Name | Value |
|------|-------|
| WIZA_API_KEY | c951d1f0b91ab7e5afe187fa747f3668524ad5e2eba2c68a912654b43682cab8 |
| NEXT_PUBLIC_SUPABASE_URL | https://rnelxyjhdlklmbhlzcou.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4eWpoZGxrbG1iaGx6Y291Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NDkzNTIsImV4cCI6MjA2NTMyNTM1Mn0.P7FHDMekLm49KWueI2TSvS0q5KjqHOLLppbqUX37ews |
| JWT_SECRET | bd91a7cd5343787681e5d2a78b14a07f80247376997514e817398ad5dc30a4deeac47bef98e1d4939ba4967af548e5c75d1d124a7e7b3071d763c138fb83e6c7 |

### Step 4: Deploy
Click "Deploy" and wait for the build to complete.

## Post-Deployment

### Access Your App
Your app will be available at:
- `https://your-project-name.vercel.app`
- Custom domain (if configured)

### Login Credentials
- Username: `lirong`
- Password: `Qq221122`

### Important Security Notes
1. **Change JWT_SECRET in production** - Generate a new secure secret
2. **Update admin password** after first login
3. **Monitor Wiza API usage** to avoid exceeding limits

## Troubleshooting

### Build Errors
If you encounter build errors:
1. Check the build logs in Vercel dashboard
2. Ensure all dependencies are in package.json
3. Try building locally first: `npm run build`

### Environment Variable Issues
- Variables starting with `NEXT_PUBLIC_` are exposed to the browser
- Other variables are server-side only
- Redeploy after changing environment variables

### Database Connection Issues
- Verify Supabase URL and anon key are correct
- Check Supabase dashboard for any issues
- Ensure the database schema is properly set up

## Updating Your Deployment

To update your deployed app:
```bash
git add .
git commit -m "Your update message"
git push origin main
```

Vercel will automatically redeploy on push to main branch.

## Need Help?
- Vercel Documentation: https://vercel.com/docs
- Next.js Documentation: https://nextjs.org/docs
- Supabase Documentation: https://supabase.com/docs 