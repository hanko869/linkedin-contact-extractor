import { NextResponse } from 'next/server';
import { getUser } from '@/utils/auth';
import { getRecentActivities } from '@/utils/userDb';

export async function GET() {
  // Check if user is authenticated and is admin
  const user = await getUser();
  
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const activities = await getRecentActivities(100);
    return NextResponse.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
} 