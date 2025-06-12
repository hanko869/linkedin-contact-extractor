import React from 'react';
import ContactExtractor from '@/components/ContactExtractor';
import { getUser } from '@/utils/auth';
import { redirect } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

export default async function Home() {
  const user = await getUser();
  
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex-1"></div>
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900">
                LinkedIn Contact Extractor
              </h1>
            </div>
            <div className="flex-1 flex justify-end items-center gap-4">
              <span className="text-sm text-gray-600">Welcome, {user.username}</span>
              {user.role === 'admin' && (
                <a 
                  href="/admin" 
                  className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded transition-colors"
                >
                  Admin Dashboard
                </a>
              )}
              <LogoutButton />
            </div>
          </div>
          <p className="text-lg text-gray-600 text-center">
            Extract and manage contact details from LinkedIn profiles using their direct URLs
          </p>
        </div>

        {/* Main Content */}
        <div>
          <ContactExtractor />
        </div>

      </div>
    </div>
  );
}
