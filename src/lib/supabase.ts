import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions for our database
export interface DbUser {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'user';
  created_at: string;
  last_login?: string;
  is_active: boolean;
}

export interface DbActivity {
  id: string;
  user_id: string;
  username: string;
  action: 'login' | 'logout' | 'extract_contact';
  details?: string;
  timestamp: string;
  linkedin_url?: string;
  contact_name?: string;
  success?: boolean;
}

export interface DbContact {
  id: string;
  user_id: string;
  name: string;
  title?: string;
  company?: string;
  emails: string[];
  phones: string[];
  linkedin_url: string;
  extracted_at: string;
} 