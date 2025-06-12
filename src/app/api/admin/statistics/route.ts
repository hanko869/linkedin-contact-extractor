import { NextResponse } from 'next/server';
import { getUser } from '@/utils/auth';
import { getOverallStatistics } from '@/utils/userDb';

export async function GET() {
  // Check if user is authenticated and is admin
  const user = await getUser();
  
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const statistics = await getOverallStatistics();
    return NextResponse.json(statistics);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
} 