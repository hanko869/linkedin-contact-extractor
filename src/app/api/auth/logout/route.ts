import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUser } from '@/utils/auth';
import { logActivity } from '@/utils/userDb';

export async function POST() {
  try {
    // Get current user before clearing the token
    const user = await getUser();
    
    if (user) {
      // Log logout activity
      logActivity({
        userId: user.id,
        username: user.username,
        action: 'logout',
        details: 'User logged out'
      });
    }
    
    const cookieStore = await cookies();
    
    cookieStore.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: true }); // Still log out even if activity logging fails
  }
} 