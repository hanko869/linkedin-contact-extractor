import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/utils/auth';
import { getAllUsers, createUser } from '@/utils/userDb';

// GET all users
export async function GET() {
  try {
    const user = await getUser();
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const users = getAllUsers();
    
    // Remove passwords from response
    const safeUsers = users.map(({ password, ...user }) => user);
    
    return NextResponse.json({ users: safeUsers });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST create new user
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { username, password, role } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    if (role && !['admin', 'user'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    try {
      const newUser = createUser(username, password, role || 'user');
      const { password: _, ...safeUser } = newUser;
      
      return NextResponse.json({ user: safeUser });
    } catch (err: any) {
      if (err.message === 'Username already exists') {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 400 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
} 