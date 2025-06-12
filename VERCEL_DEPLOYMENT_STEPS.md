# Vercel Deployment - Web Interface Method

Since we're encountering build issues with the CLI, let's use the Vercel web interface for deployment.

## Step 1: Prepare Your Code

First, ensure your code is pushed to GitHub:

```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

## Step 2: Go to Vercel Dashboard

1. Visit https://vercel.com
2. Sign in with your account
3. Click "Add New..." → "Project"

## Step 3: Import Your Repository

1. Click "Import Git Repository"
2. If not connected, connect your GitHub account
3. Find and select your `linkedin-contact-extractor` repository
4. Click "Import"

## Step 4: Configure Your Project

### Basic Settings:
- **Project Name**: linkedin-contact-extractor (or your preferred name)
- **Framework Preset**: Next.js (should be auto-detected)
- **Root Directory**: ./ (leave as is)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### Environment Variables:
Click "Environment Variables" and add these one by one:

1. **WIZA_API_KEY**
   ```
   c951d1f0b91ab7e5afe187fa747f3668524ad5e2eba2c68a912654b43682cab8
   ```

2. **NEXT_PUBLIC_SUPABASE_URL**
   ```
   https://rnelxyjhdlklmbhlzcou.supabase.co
   ```

3. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4eWpoZGxrbG1iaGx6Y291Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NDkzNTIsImV4cCI6MjA2NTMyNTM1Mn0.P7FHDMekLm49KWueI2TSvS0q5KjqHOLLppbqUX37ews
   ```

4. **JWT_SECRET**
   ```
   bd91a7cd5343787681e5d2a78b14a07f80247376997514e817398ad5dc30a4deeac47bef98e1d4939ba4967af548e5c75d1d124a7e7b3071d763c138fb83e6c7
   ```

## Step 5: Deploy

1. After adding all environment variables, click "Deploy"
2. Wait for the build to complete (usually 2-5 minutes)
3. If the build fails, check the build logs for errors

## Step 6: Access Your App

Once deployed successfully:
- Your app URL will be: `https://[your-project-name].vercel.app`
- You can add a custom domain later in project settings

## Step 7: Test Your Deployment

1. Visit your deployed URL
2. Login with:
   - Username: `lirong`
   - Password: `Qq221122`
3. Test the LinkedIn contact extraction feature

## Troubleshooting

### If Build Fails:
1. Check the build logs in Vercel dashboard
2. Common issues:
   - Missing dependencies: Ensure all are in package.json
   - Environment variables: Double-check they're all added
   - Build errors: May need to fix TypeScript errors

### If Login Fails:
1. Ensure your Supabase database is accessible
2. Verify the password hash is correct in your database
3. Check that environment variables are properly set

## Alternative: Deploy from GitHub

If you prefer automatic deployments:
1. In Vercel project settings, connect to your GitHub repo
2. Enable automatic deployments on push to main branch
3. Every git push will trigger a new deployment

## Security Reminder

For production use:
1. Generate a new JWT_SECRET (use a password generator)
2. Change the default admin password
3. Consider adding rate limiting for API calls
4. Monitor your Wiza API usage 