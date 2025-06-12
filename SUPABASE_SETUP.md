# Supabase Setup Guide

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New project"
4. Fill in:
   - Project name: `linkedin-contact-extractor`
   - Database password: (save this securely)
   - Region: Choose closest to you
5. Click "Create new project"

## 2. Run Database Schema

1. In your Supabase dashboard, go to the SQL Editor
2. Click "New query"
3. Copy and paste the contents of `supabase-schema.sql` from this project
4. Click "Run" to execute the schema

This will create:
- `users` table with the default admin user (lirong/Qq221122)
- `activities` table for tracking user actions
- `contacts` table for storing extracted contacts
- Necessary indexes for performance

## 3. Get Your API Keys

1. In Supabase dashboard, go to Settings → API
2. You'll need:
   - **Project URL**: `https://your-project-ref.supabase.co`
   - **Anon public key**: `eyJhbGc...` (this is safe to expose)

## 4. Update Environment Variables

### For Local Development

Update your `.env.local` file:
```env
# Existing Wiza API key
WIZA_API_KEY=9fe5cd52-cc26-4daa-b4e6-41b0cc2c1137

# Add these Supabase variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# JWT secret for authentication
JWT_SECRET=your-very-secure-secret-key-change-this-in-production
```

### For Vercel Deployment

Add these environment variables in Vercel dashboard:
- `WIZA_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `JWT_SECRET`

## 5. Test the Connection

After setting up:
1. Run `npm run dev`
2. Try logging in with: lirong / Qq221122
3. Extract a contact to verify database connection

## 6. Security Notes

- The anon key is safe to expose (it's meant for client-side use)
- Never expose your service role key
- Change the JWT_SECRET in production
- Consider enabling Row Level Security (RLS) for additional protection

## 7. Backup Strategy

Supabase provides:
- Daily automatic backups (Pro plan)
- Point-in-time recovery
- Manual backup downloads

## 8. Monitoring

In Supabase dashboard, you can monitor:
- Database usage
- API requests
- Performance metrics
- Error logs

## Troubleshooting

### "Failed to fetch" errors
- Check if your Supabase project is active
- Verify environment variables are set correctly
- Check Supabase dashboard for any API errors

### Authentication issues
- Ensure JWT_SECRET matches between local and production
- Check if the user exists in the database
- Verify cookies are enabled in the browser

### Database connection issues
- Check if you're within Supabase free tier limits
- Verify the database hasn't been paused (happens after 1 week of inactivity on free tier)
- Check network/firewall settings 