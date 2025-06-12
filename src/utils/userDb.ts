import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

// Define user and activity types
export interface User {
  id: string;
  username: string;
  password: string; // hashed
  role: 'admin' | 'user';
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
}

export interface UserActivity {
  id: string;
  userId: string;
  username: string;
  action: 'login' | 'logout' | 'extract_contact';
  details?: string;
  timestamp: string;
  linkedinUrl?: string;
  contactName?: string;
  success?: boolean;
}

// Database file paths
const DB_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const ACTIVITIES_FILE = path.join(DB_DIR, 'activities.json');

// Ensure database directory and files exist
const initializeDb = () => {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Initialize users file with default admin if it doesn't exist
  if (!fs.existsSync(USERS_FILE)) {
    const defaultUsers: User[] = [
      {
        id: '1',
        username: 'lirong',
        password: bcrypt.hashSync('Qq221122', 10),
        role: 'admin',
        createdAt: new Date().toISOString(),
        isActive: true
      }
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
  }

  // Initialize activities file if it doesn't exist
  if (!fs.existsSync(ACTIVITIES_FILE)) {
    fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify([], null, 2));
  }
};

// User Management Functions
export const getAllUsers = (): User[] => {
  initializeDb();
  const data = fs.readFileSync(USERS_FILE, 'utf-8');
  return JSON.parse(data);
};

export const getUserById = (id: string): User | null => {
  const users = getAllUsers();
  return users.find(user => user.id === id) || null;
};

export const getUserByUsername = (username: string): User | null => {
  const users = getAllUsers();
  return users.find(user => user.username.toLowerCase() === username.toLowerCase()) || null;
};

export const createUser = (username: string, password: string, role: 'admin' | 'user' = 'user'): User => {
  const users = getAllUsers();
  
  // Check if username already exists
  if (users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Username already exists');
  }

  const newUser: User = {
    id: Date.now().toString(),
    username,
    password: bcrypt.hashSync(password, 10),
    role,
    createdAt: new Date().toISOString(),
    isActive: true
  };

  users.push(newUser);
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  
  return newUser;
};

export const updateUserLastLogin = (userId: string): void => {
  const users = getAllUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  
  if (userIndex !== -1) {
    users[userIndex].lastLogin = new Date().toISOString();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  }
};

export const toggleUserStatus = (userId: string): void => {
  const users = getAllUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  
  if (userIndex !== -1) {
    users[userIndex].isActive = !users[userIndex].isActive;
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  }
};

export const deleteUser = (userId: string): void => {
  const users = getAllUsers();
  const filteredUsers = users.filter(user => user.id !== userId);
  fs.writeFileSync(USERS_FILE, JSON.stringify(filteredUsers, null, 2));
};

// Activity Tracking Functions
export const getAllActivities = (): UserActivity[] => {
  initializeDb();
  const data = fs.readFileSync(ACTIVITIES_FILE, 'utf-8');
  return JSON.parse(data);
};

export const getUserActivities = (userId: string): UserActivity[] => {
  const activities = getAllActivities();
  return activities.filter(activity => activity.userId === userId);
};

export const getRecentActivities = (limit: number = 50): UserActivity[] => {
  const activities = getAllActivities();
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
};

export const logActivity = (activity: Omit<UserActivity, 'id' | 'timestamp'>): void => {
  const activities = getAllActivities();
  
  const newActivity: UserActivity = {
    ...activity,
    id: Date.now().toString(),
    timestamp: new Date().toISOString()
  };

  activities.push(newActivity);
  
  // Keep only last 1000 activities to prevent file from growing too large
  const recentActivities = activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 1000);
    
  fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(recentActivities, null, 2));
};

// Statistics Functions
export const getUserStatistics = (userId: string) => {
  const activities = getUserActivities(userId);
  const user = getUserById(userId);
  
  const loginCount = activities.filter(a => a.action === 'login').length;
  const extractionCount = activities.filter(a => a.action === 'extract_contact').length;
  const successfulExtractions = activities.filter(a => a.action === 'extract_contact' && a.success).length;
  
  return {
    user,
    loginCount,
    extractionCount,
    successfulExtractions,
    successRate: extractionCount > 0 ? (successfulExtractions / extractionCount * 100).toFixed(1) : '0',
    lastActivity: activities[0]?.timestamp || null
  };
};

export const getOverallStatistics = () => {
  const users = getAllUsers();
  const activities = getAllActivities();
  
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.isActive).length;
  const totalExtractions = activities.filter(a => a.action === 'extract_contact').length;
  const successfulExtractions = activities.filter(a => a.action === 'extract_contact' && a.success).length;
  const todayActivities = activities.filter(a => {
    const activityDate = new Date(a.timestamp).toDateString();
    const today = new Date().toDateString();
    return activityDate === today;
  });
  
  return {
    totalUsers,
    activeUsers,
    totalExtractions,
    successfulExtractions,
    successRate: totalExtractions > 0 ? (successfulExtractions / totalExtractions * 100).toFixed(1) : '0',
    todayActivityCount: todayActivities.length,
    recentActivities: getRecentActivities(10)
  };
}; 