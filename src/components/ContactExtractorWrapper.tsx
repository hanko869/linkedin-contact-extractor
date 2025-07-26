'use client';

import dynamic from 'next/dynamic';
import { LanguageProvider } from '@/contexts/LanguageContext';

// Dynamically import ContactExtractor to avoid SSR issues with localStorage
const ContactExtractor = dynamic(() => import('./ContactExtractor'), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
});

export default function ContactExtractorWrapper() {
  return (
    <LanguageProvider>
      <ContactExtractor />
    </LanguageProvider>
  );
} 