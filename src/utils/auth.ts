import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { getUserByUsername, updateUserLastLogin, logActivity, User as DbUser } from './userDb';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
);

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export async function verifyCredentials(username: string, password: string): Promise<DbUser | null> {
  const user = await getUserByUsername(username);
  
  if (!user || !user.is_active) {
    return null;
  }
  
  const isValidPassword = await bcrypt.compare(password, user.password);
  
  if (!isValidPassword) {
    return null;
  }
  
  // Update last login
  await updateUserLastLogin(user.id);
  
  // Log login activity
  await logActivity({
    user_id: user.id,
    username: user.username,
    action: 'login',
    details: 'User logged in successfully'
  });
  
  return user;
}

export async function createToken(user: DbUser): Promise<string> {
  const token = await new SignJWT({ 
    id: user.id,
    username: user.username,
    role: user.role 
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
  
  return token;
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { 
      id: payload.id as string,
      username: payload.username as string,
      role: payload.role as 'admin' | 'user'
    };
  } catch (error) {
    return null;
  }
}

export async function getUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  
  if (!token) return null;
  
  return verifyToken(token);
} 