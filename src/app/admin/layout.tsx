'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated and is admin
    fetch('/api/auth/check')
      .then(res => res.json())
      .then(data => {
        if (data.user && data.user.role === 'admin') {
          setUser(data.user);
        } else {
          router.push('/login');
        }
        setLoading(false);
      })
      .catch(() => {
        router.push('/login');
        setLoading(false);
      });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-gray-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <nav className="flex space-x-6">
                <Link 
                  href="/admin" 
                  className="hover:text-blue-400 transition-colors"
                >
                  Overview
                </Link>
                <Link 
                  href="/admin/users" 
                  className="hover:text-blue-400 transition-colors"
                >
                  Users
                </Link>
                <Link 
                  href="/admin/activity" 
                  className="hover:text-blue-400 transition-colors"
                >
                  Activity Log
                </Link>
                <Link 
                  href="/" 
                  className="hover:text-blue-400 transition-colors"
                >
                  Main App
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm">Welcome, {user.username}</span>
              <button
                onClick={() => {
                  fetch('/api/auth/logout', { method: 'POST' })
                    .then(() => router.push('/login'));
                }}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
} 