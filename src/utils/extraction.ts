import { Contact, ExtractionResult } from '@/types/contact';

// Generate unique ID for contacts
export const generateContactId = (): string => {
  return `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Validate LinkedIn URL format
export const isValidLinkedInUrl = (url: string): boolean => {
  // More permissive pattern to allow various LinkedIn URL formats
  const linkedinPattern = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%.]+\/?(\?.*)?$/;
  return linkedinPattern.test(url);
};

// Simulation function for demonstration purposes
export const simulateContactExtraction = async (linkedinUrl: string): Promise<ExtractionResult> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

  // Mock extraction with some randomness for demonstration
  const isSuccessful = Math.random() > 0.3; // 70% success rate for demo

  if (!isSuccessful) {
    return {
      success: false,
      error: 'Could not extract contact information. The profile may be private or have limited public information.'
    };
  }

  // Generate mock contact data for demonstration
  const profileName = linkedinUrl.split('/in/')[1]?.replace('/', '').replace('-', ' ');
  const mockEmails = [
    `${profileName?.replace(' ', '.')}@gmail.com`,
    `${profileName?.replace(' ', '.')}@company.com`,
    `contact@${profileName?.replace(' ', '')}.com`
  ];
  const mockPhones = [
    '+1 (555) 123-4567',
    '+1 (555) 987-6543',
    '+44 20 7946 0958'
  ];

  const contact: Contact = {
    id: generateContactId(),
    linkedinUrl,
    name: profileName?.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Professional Contact',
    email: Math.random() > 0.2 ? mockEmails[Math.floor(Math.random() * mockEmails.length)] : undefined,
    phone: Math.random() > 0.4 ? mockPhones[Math.floor(Math.random() * mockPhones.length)] : undefined,
    extractedAt: new Date().toISOString()
  };

  return {
    success: true,
    contact
  };
};

// Real API extraction using our backend endpoint
export const extractContactFromAPI = async (linkedinUrl: string): Promise<ExtractionResult> => {
  try {
    const response = await fetch('/api/extract-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedinUrl })
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('API extraction error:', error);
    return {
      success: false,
      error: 'Network error occurred during extraction'
    };
  }
};

// Extract contact information from LinkedIn URL using Wiza API
export const extractContactFromLinkedIn = async (linkedinUrl: string): Promise<ExtractionResult> => {
  if (!isValidLinkedInUrl(linkedinUrl)) {
    return {
      success: false,
      error: 'Invalid LinkedIn URL format'
    };
  }

  // Always use server API to keep API keys private and avoid client env issues
  return await extractContactFromAPI(linkedinUrl);
};

// Check if Wiza API is configured
export const checkAPIConfiguration = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/extract-contact', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.status === 'ready' && data.provider === 'Wiza API';
    }
    
    return false;
  } catch (error) {
    console.error('API configuration check failed:', error);
    return false;
  }
}; 