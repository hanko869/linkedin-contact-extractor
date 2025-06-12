-- Create users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  last_login TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true NOT NULL
);

-- Create activities table
CREATE TABLE activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('login', 'logout', 'extract_contact')),
  details TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  linkedin_url TEXT,
  contact_name TEXT,
  success BOOLEAN
);

-- Create contacts table (for storing extracted contacts)
CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  emails TEXT[] DEFAULT ARRAY[]::TEXT[],
  phones TEXT[] DEFAULT ARRAY[]::TEXT[],
  linkedin_url TEXT NOT NULL,
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_timestamp ON activities(timestamp);
CREATE INDEX idx_contacts_user_id ON contacts(user_id);

-- Insert default admin user (password: Qq221122)
-- Note: The password is already hashed with bcrypt
-- To generate a new hash: SELECT crypt('your-password', gen_salt('bf'));
INSERT INTO users (username, password, role)
VALUES ('lirong', '$2a$10$xLGz8Y7RTM9h3nYRNxvBOePpZCjcF3v5WqZ9lPQ8Kyt/7nIPHqfAK', 'admin'); 