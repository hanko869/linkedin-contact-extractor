import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUser } from '@/utils/auth';
import { logActivity } from '@/utils/userDb';

export async function POST() {
  try {
    // Get current user before logout
    const user = await getUser();
    
    if (user) {
      // Log logout activity
      await logActivity({
        user_id: user.id,
        username: user.username,
        action: 'logout',
        details: 'User logged out'
      });
    }
    
    // Clear the auth cookie
    const cookieStore = await cookies();
    cookieStore.delete('auth-token');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: true }); // Still logout even if logging fails
  }
} 