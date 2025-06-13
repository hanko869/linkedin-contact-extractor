import React from 'react';
import ContactExtractorWrapper from '@/components/ContactExtractorWrapper';
import { getUser } from '@/utils/auth';
import { redirect } from 'next/navigation';
import Navigation from '@/components/Navigation';

export default async function Home() {
  const user = await getUser();
  
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <Navigation user={user} />

      {/* Main Content */}
      <ContactExtractorWrapper />
    </div>
  );
}
