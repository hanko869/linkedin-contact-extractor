'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          language === 'en'
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage('zh')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          language === 'zh'
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        中文
      </button>
    </div>
  );
} 