import { NextResponse } from 'next/server';
import { getUser } from '@/utils/auth';
import { getRecentActivities } from '@/utils/userDb';

export async function GET() {
  try {
    // Check if user is authenticated and is admin
    const user = await getUser();
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get recent activities (limit to 200 for performance)
    const activities = getRecentActivities(200);
    
    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Activities error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
} 