import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/utils/auth';
import { getAllUsers, createUser } from '@/utils/userDb';

// GET all users
export async function GET() {
  const user = await getUser();
  
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await getAllUsers();
    // Remove password from response
    const sanitizedUsers = users.map(({ password, ...rest }) => rest);
    return NextResponse.json(sanitizedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST create new user
export async function POST(request: NextRequest) {
  const user = await getUser();
  
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { username, password, role } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    if (role && !['admin', 'user'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be either admin or user' },
        { status: 400 }
      );
    }

    const newUser = await createUser(username, password, role || 'user');
    const { password: _, ...sanitizedUser } = newUser;
    
    return NextResponse.json(sanitizedUser, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Username already exists') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
} 