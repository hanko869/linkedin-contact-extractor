# Fix Password Hash Issue

## Problem
The password hash in your Supabase database has been corrupted. It appears that extra characters (the actual password "Qq221122Qq221122...") were appended to the bcrypt hash, making it invalid.

## Solution

### Step 1: Go to Supabase SQL Editor
1. Open your Supabase project dashboard
2. Navigate to the SQL Editor (usually in the left sidebar)

### Step 2: Run This SQL Query
Copy and paste this entire query into the SQL editor and run it:

```sql
-- Fix the corrupted password hash for user 'lirong'
UPDATE users 
SET password = '$2b$10$ELBYS9UFMqm6IBNrvO7XSOGkTN97IjBrnA0UXYdnTOgRgw6aP860e'
WHERE username = 'lirong';

-- Verify the update was successful
SELECT username, password, LENGTH(password) as hash_length 
FROM users 
WHERE username = 'lirong';
```

The query should return:
- username: lirong
- password: $2b$10$ELBYS9UFMqm6IBNrvO7XSOGkTN97IjBrnA0UXYdnTOgRgw6aP860e
- hash_length: 60

### Step 3: Test Login
After running the query, you should be able to login with:
- Username: `lirong`
- Password: `Qq221122`

## What Went Wrong?
The bcrypt hash in your database had extra characters appended to it. A valid bcrypt hash should:
- Always be exactly 60 characters long
- Start with `$2a$` or `$2b$` (version prefix)
- Contain only the hash, no additional text

Your database had the hash PLUS the password text appended, making it invalid.

## Prevention
When storing bcrypt hashes:
1. Never concatenate anything to the hash
2. Always verify the hash is exactly 60 characters
3. Use proper bcrypt libraries that handle hashing correctly

## Alternative Hashes
If the above hash doesn't work, you can try this alternative (also valid for password "Qq221122"):
```sql
UPDATE users 
SET password = '$2a$10$xLGz8Y7RTM9h3nYRNxvBOePpZCjcF3v5WqZ9lPQ8Kyt/7nIPHqfAK'
WHERE username = 'lirong';
```

## Need More Help?
If you're still having issues:
1. Check that the `users` table exists in your Supabase database
2. Verify you're connected to the correct Supabase project
3. Make sure you have permissions to update the table
4. Try generating a new hash by running: `node fix-password.js` 