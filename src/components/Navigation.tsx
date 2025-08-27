'use client';

import React from 'react';
import LogoutButton from '@/components/LogoutButton';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';

interface NavigationProps {
  user?: {
    username: string;
    role: string;
  };
}

export default function Navigation({ user }: NavigationProps) {
  const { t } = useLanguage();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <a href="/" className="flex-shrink-0">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center hover:shadow-lg transition-all duration-200">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
            </a>
          </div>
          
          <div className="flex items-center gap-6">
            <LanguageSwitcher />
            {user && (
              <span className="text-sm text-gray-700">
                {t.nav.welcome}, <span className="font-semibold">{user.username}</span>
              </span>
            )}
            <a 
              href="/prospects" 
              className="text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-md transition-all duration-200"
            >
              Prospect Search
            </a>
            {user?.role === 'admin' && (
              <a 
                href="/admin" 
                className="text-sm bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-md transition-all duration-200"
              >
                {t.nav.adminDashboard}
              </a>
            )}
            <LogoutButton />
          </div>
        </div>
      </div>
    </nav>
  );
} 