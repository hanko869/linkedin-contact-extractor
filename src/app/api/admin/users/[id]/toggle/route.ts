import { NextResponse } from 'next/server';
import { getUser } from '@/utils/auth';
import { toggleUserStatus } from '@/utils/userDb';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser();
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const userId = params.id;
    
    // Prevent admin from deactivating themselves
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 400 }
      );
    }

    toggleUserStatus(userId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Toggle user status error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle user status' },
      { status: 500 }
    );
  }
} 