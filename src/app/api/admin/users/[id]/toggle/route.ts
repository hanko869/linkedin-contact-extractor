import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/utils/auth';
import { toggleUserStatus, getUserById } from '@/utils/userDb';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;
    
    // Prevent admin from deactivating themselves
    if (user.id === id) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 400 }
      );
    }

    await toggleUserStatus(id);
    const updatedUser = await getUserById(id);
    
    if (updatedUser) {
      const { password, ...sanitizedUser } = updatedUser;
      return NextResponse.json(sanitizedUser);
    } else {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error toggling user status:', error);
    return NextResponse.json({ error: 'Failed to update user status' }, { status: 500 });
  }
} 