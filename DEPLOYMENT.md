# Deployment Guide

## Environment Variables

You need to set the following environment variables in your deployment:

```
WIZA_API_KEY=9fe5cd52-cc26-4daa-b4e6-41b0cc2c1137
JWT_SECRET=your-very-secure-secret-key-change-this-in-production
```

## Deployment Steps

### Option 1: Deploy with Vercel CLI

1. Run `vercel` in the project directory
2. Follow the prompts
3. When asked about environment variables, add the two variables above

### Option 2: Deploy via GitHub + Vercel

1. Push your code to GitHub
2. Go to https://vercel.com
3. Sign up/login
4. Click "New Project"
5. Import your GitHub repository
6. Add environment variables in the Vercel dashboard
7. Click "Deploy"

## Important Notes

- Make sure to change the `JWT_SECRET` to a secure random string in production
- The app uses file-based storage (data/*.json), which won't persist across deployments on Vercel
- For production, consider using a proper database like PostgreSQL or MongoDB

## Default Admin Credentials

- Username: lirong
- Password: Qq221122

Remember to change these in production! 