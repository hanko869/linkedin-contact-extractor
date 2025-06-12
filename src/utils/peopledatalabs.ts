import { Contact, ExtractionResult } from '@/types/contact';
import { generateContactId } from './extraction';

// PeopleDataLabs API response interface
interface PDLPersonResponse {
  status: number;
  data?: {
    full_name?: string;
    emails?: Array<{
      address: string;
      type?: string;
    }> | boolean;
    phone_numbers?: Array<{
      number: string;
      type?: string;
    }> | boolean;
    linkedin_url?: string;
    job_title?: string;
    job_company_name?: string;
    // Contact fields that may be boolean on free plans
    work_email?: string | boolean;
    personal_emails?: string[] | string | boolean;
    recommended_personal_email?: string | boolean;
    mobile_phone?: string | boolean;
    // Allow for any additional fields that might be present
    [key: string]: any;
  };
  error?: {
    type: string;
    message: string;
  };
}

// Extract LinkedIn username from URL
const extractLinkedInUsername = (url: string): string | null => {
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  return match ? match[1] : null;
};

// Check if we're dealing with free plan boolean responses
const isFreeplanBooleanResponse = (person: any): boolean => {
  return (
    (person.emails === true || person.emails === false) ||
    (person.phone_numbers === true || person.phone_numbers === false) ||
    (person.work_email === true || person.work_email === false) ||
    (person.personal_emails === true || person.personal_emails === false) ||
    (person.mobile_phone === true || person.mobile_phone === false) ||
    (person.recommended_personal_email === true || person.recommended_personal_email === false)
  );
};

// Enrich person data using LinkedIn URL
export const enrichPersonWithLinkedIn = async (linkedinUrl: string): Promise<ExtractionResult> => {
  const apiKey = process.env.PEOPLEDATALABS_API_KEY;
  const baseUrl = process.env.PEOPLEDATALABS_BASE_URL || 'https://api.peopledatalabs.com/v5';

  if (!apiKey) {
    return {
      success: false,
      error: 'PeopleDataLabs API key not configured. Please add PEOPLEDATALABS_API_KEY to your environment variables.'
    };
  }

  const username = extractLinkedInUsername(linkedinUrl);
  if (!username) {
    return {
      success: false,
      error: 'Invalid LinkedIn URL format. Please use format: https://linkedin.com/in/username'
    };
  }

  try {
    // Use the person enrichment endpoint with optimized parameters
    const searchParams = new URLSearchParams({
      profile: linkedinUrl,
      min_likelihood: '6',
      pretty: 'true',
      // Request specific fields to optimize for contact data
      data_include: 'full_name,emails,phone_numbers,work_email,personal_emails,recommended_personal_email,mobile_phone,linkedin_url,job_title,job_company_name'
    });

    const response = await fetch(`${baseUrl}/person/enrich?${searchParams}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    const data: PDLPersonResponse = await response.json();

    // Enhanced debug logging
    console.log('PeopleDataLabs API Response:', {
      status: data.status,
      hasData: !!data.data,
      fullResponse: data, // Log the entire response to see structure
      emails: data.data?.emails,
      phoneNumbers: data.data?.phone_numbers,
      fullName: data.data?.full_name,
      emailsType: typeof data.data?.emails,
      emailsIsArray: Array.isArray(data.data?.emails),
      phonesType: typeof data.data?.phone_numbers,
      phonesIsArray: Array.isArray(data.data?.phone_numbers),
      workEmail: data.data?.work_email,
      personalEmails: data.data?.personal_emails,
      mobilePhone: data.data?.mobile_phone,
      recommendedEmail: data.data?.recommended_personal_email
    });

    if (data.status === 200 && data.data) {
      const person = data.data;
      
      // Check if this is a free plan response with boolean flags
      if (isFreeplanBooleanResponse(person)) {
        const hasContactData = (
          person.emails === true || 
          person.phone_numbers === true ||
          person.work_email === true ||
          person.personal_emails === true ||
          person.mobile_phone === true ||
          person.recommended_personal_email === true
        );

        if (hasContactData) {
          return {
            success: false,
            error: `🔒 Contact information found but requires PeopleDataLabs Pro subscription!\n\nYour current plan returns boolean flags instead of actual contact data:\n• Email available: ${person.emails === true || person.work_email === true || person.personal_emails === true || person.recommended_personal_email === true}\n• Phone available: ${person.phone_numbers === true || person.mobile_phone === true}\n\nTo access actual email addresses and phone numbers, please upgrade to a PeopleDataLabs Pro plan at https://www.peopledatalabs.com/pricing`
          };
        } else {
          return {
            success: false,
            error: 'No contact information available for this LinkedIn profile in the PeopleDataLabs database.'
          };
        }
      }

      // Handle actual contact data extraction for Pro plans
      let primaryEmail: string | undefined;
      let primaryPhone: string | undefined;

      // Extract email information from Pro plan responses
      if (typeof person.work_email === 'string' && person.work_email !== 'false') {
        primaryEmail = person.work_email;
      } else if (typeof person.recommended_personal_email === 'string' && person.recommended_personal_email !== 'false') {
        primaryEmail = person.recommended_personal_email;
      } else if (Array.isArray(person.personal_emails) && person.personal_emails.length > 0) {
        primaryEmail = person.personal_emails[0];
      } else if (typeof person.personal_emails === 'string' && person.personal_emails !== 'false') {
        primaryEmail = person.personal_emails;
      } else if (Array.isArray(person.emails) && person.emails.length > 0) {
        // Fallback to generic emails array if it exists
        const emailItem = person.emails[0];
        primaryEmail = typeof emailItem === 'string' ? emailItem : emailItem.address;
      }

      // Extract phone information from Pro plan responses
      if (typeof person.mobile_phone === 'string' && person.mobile_phone !== 'false') {
        primaryPhone = person.mobile_phone;
      } else if (Array.isArray(person.phone_numbers) && person.phone_numbers.length > 0) {
        const phoneItem = person.phone_numbers[0];
        primaryPhone = typeof phoneItem === 'string' ? phoneItem : phoneItem.number;
      }

      // Log what we found for debugging
      console.log('Contact field analysis:', {
        workEmail: person.work_email,
        personalEmails: person.personal_emails,
        recommendedEmail: person.recommended_personal_email,
        mobilePhone: person.mobile_phone,
        genericEmails: person.emails,
        genericPhones: person.phone_numbers,
        extractedEmail: primaryEmail,
        extractedPhone: primaryPhone,
        isFreeplanResponse: isFreeplanBooleanResponse(person)
      });

      // Validate that we actually have contact information
      if (!primaryEmail && !primaryPhone) {
        return {
          success: false,
          error: 'Profile found but no contact information available. This person may not have publicly accessible contact details in the PeopleDataLabs database.'
        };
      }

      const contact: Contact = {
        id: generateContactId(),
        linkedinUrl,
        name: person.full_name || `Contact from ${username}`,
        email: primaryEmail,
        phone: primaryPhone,
        extractedAt: new Date().toISOString()
      };

      console.log('Contact created:', {
        name: contact.name,
        hasEmail: !!contact.email,
        hasPhone: !!contact.phone,
        email: contact.email,
        phone: contact.phone
      });

      return {
        success: true,
        contact
      };
    } else {
      // Handle specific API errors
      let errorMessage = 'No contact information found for this LinkedIn profile';
      
      if (data.status === 404) {
        errorMessage = 'This LinkedIn profile was not found in PeopleDataLabs database';
      } else if (data.status === 401) {
        errorMessage = 'Invalid API key or authentication failed';
      } else if (data.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later';
      } else if (data.status === 402) {
        errorMessage = 'No contact information available for this profile (you were not charged)';
      } else if (data.error) {
        errorMessage = data.error.message;
      }

      console.log('API Error:', { status: data.status, error: data.error });

      return {
        success: false,
        error: errorMessage
      };
    }
  } catch (error) {
    console.error('PeopleDataLabs API error:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        success: false,
        error: 'Network error. Please check your internet connection and try again.'
      };
    }
    
    return {
      success: false,
      error: 'An unexpected error occurred while extracting contact information.'
    };
  }
};

// Alternative search method using LinkedIn username directly
export const searchPersonByLinkedInUsername = async (linkedinUrl: string): Promise<ExtractionResult> => {
  const apiKey = process.env.PEOPLEDATALABS_API_KEY;
  const baseUrl = process.env.PEOPLEDATALABS_BASE_URL || 'https://api.peopledatalabs.com/v5';

  if (!apiKey) {
    return {
      success: false,
      error: 'PeopleDataLabs API key not configured'
    };
  }

  const username = extractLinkedInUsername(linkedinUrl);
  if (!username) {
    return {
      success: false,
      error: 'Invalid LinkedIn URL format'
    };
  }

  try {
    // Use the search endpoint with proper SQL syntax
    const searchParams = new URLSearchParams({
      sql: `SELECT * FROM person WHERE linkedin_url='${linkedinUrl}'`,
      size: '1',
      pretty: 'true'
    });

    const response = await fetch(`${baseUrl}/person/search?${searchParams}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();

    console.log('Search API Response:', {
      status: data.status,
      dataCount: data.data?.length,
      fullSearchResponse: data, // Log full response
      firstResult: data.data?.[0] ? {
        hasWorkEmail: !!data.data[0].work_email,
        hasPersonalEmails: !!data.data[0].personal_emails,
        hasMobilePhone: !!data.data[0].mobile_phone,
        workEmail: data.data[0].work_email,
        personalEmails: data.data[0].personal_emails,
        mobilePhone: data.data[0].mobile_phone,
        fullName: data.data[0].full_name,
        emails: data.data[0].emails,
        phoneNumbers: data.data[0].phone_numbers,
        isFreeplanResponse: isFreeplanBooleanResponse(data.data[0])
      } : null
    });

    if (data.status === 200 && data.data && data.data.length > 0) {
      const person = data.data[0]; // Take first match
      
      // Check for free plan boolean responses in search results too
      if (isFreeplanBooleanResponse(person)) {
        const hasContactData = (
          person.emails === true || 
          person.phone_numbers === true ||
          person.work_email === true ||
          person.personal_emails === true ||
          person.mobile_phone === true ||
          person.recommended_personal_email === true
        );

        if (hasContactData) {
          return {
            success: false,
            error: `🔒 Contact information found but requires PeopleDataLabs Pro subscription!\n\nUpgrade at https://www.peopledatalabs.com/pricing to access actual email addresses and phone numbers.`
          };
        }
      }

      // Handle actual contact data extraction for Pro plans (same logic as enrichment)
      let primaryEmail: string | undefined;
      let primaryPhone: string | undefined;

      if (typeof person.work_email === 'string' && person.work_email !== 'false') {
        primaryEmail = person.work_email;
      } else if (typeof person.recommended_personal_email === 'string' && person.recommended_personal_email !== 'false') {
        primaryEmail = person.recommended_personal_email;
      } else if (Array.isArray(person.personal_emails) && person.personal_emails.length > 0) {
        primaryEmail = person.personal_emails[0];
      } else if (typeof person.personal_emails === 'string' && person.personal_emails !== 'false') {
        primaryEmail = person.personal_emails;
      } else if (Array.isArray(person.emails) && person.emails.length > 0) {
        const emailItem = person.emails[0];
        primaryEmail = typeof emailItem === 'string' ? emailItem : emailItem.address;
      }

      if (typeof person.mobile_phone === 'string' && person.mobile_phone !== 'false') {
        primaryPhone = person.mobile_phone;
      } else if (Array.isArray(person.phone_numbers) && person.phone_numbers.length > 0) {
        const phoneItem = person.phone_numbers[0];
        primaryPhone = typeof phoneItem === 'string' ? phoneItem : phoneItem.number;
      }

      // Double-check that we have contact information
      if (!primaryEmail && !primaryPhone) {
        return {
          success: false,
          error: 'Profile found but no valid contact information available.'
        };
      }

      const contact: Contact = {
        id: generateContactId(),
        linkedinUrl,
        name: person.full_name || `Contact from ${username}`,
        email: primaryEmail,
        phone: primaryPhone,
        extractedAt: new Date().toISOString()
      };

      console.log('Search contact created:', {
        name: contact.name,
        hasEmail: !!contact.email,
        hasPhone: !!contact.phone,
        email: contact.email,
        phone: contact.phone
      });

      return {
        success: true,
        contact
      };
    } else {
      return {
        success: false,
        error: 'No contact information found for this LinkedIn username in our database.'
      };
    }
  } catch (error) {
    console.error('PeopleDataLabs search error:', error);
    return {
      success: false,
      error: 'Search request failed. Please try again.'
    };
  }
};

// Rate limiting helper
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds between requests (to stay under rate limits)

export const rateLimitedEnrichment = async (linkedinUrl: string): Promise<ExtractionResult> => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
  
  // Try enrichment first, fallback to search if needed
  const result = await enrichPersonWithLinkedIn(linkedinUrl);
  
  if (!result.success && (result.error?.includes('not found') || result.error?.includes('No contact information'))) {
    // Fallback to search method
    console.log('Falling back to search method...');
    return await searchPersonByLinkedInUsername(linkedinUrl);
  }
  
  return result;
};

// API health check function to test connectivity and plan status
export const checkPDLAPIHealth = async (): Promise<{
  isConnected: boolean;
  planType: 'free' | 'pro' | 'unknown';
  error?: string;
}> => {
  const apiKey = process.env.PEOPLEDATALABS_API_KEY;
  const baseUrl = process.env.PEOPLEDATALABS_BASE_URL || 'https://api.peopledatalabs.com/v5';

  if (!apiKey) {
    return {
      isConnected: false,
      planType: 'unknown',
      error: 'API key not configured'
    };
  }

  try {
    // Test with a known LinkedIn profile to check plan type
    const testUrl = 'https://linkedin.com/in/williamhgates'; // Bill Gates - likely to have data
    const searchParams = new URLSearchParams({
      profile: testUrl,
      min_likelihood: '1',
      data_include: 'emails,work_email',
      pretty: 'true'
    });

    const response = await fetch(`${baseUrl}/person/enrich?${searchParams}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json();
    
    if (data.status === 200 && data.data) {
      const planType = isFreeplanBooleanResponse(data.data) ? 'free' : 'pro';
      return {
        isConnected: true,
        planType
      };
    } else if (data.status === 401) {
      return {
        isConnected: false,
        planType: 'unknown',
        error: 'Invalid API key'
      };
    } else {
      return {
        isConnected: true,
        planType: 'unknown',
        error: `API returned status ${data.status}`
      };
    }
  } catch (error) {
    return {
      isConnected: false,
      planType: 'unknown',
      error: error instanceof Error ? error.message : 'Connection failed'
    };
  }
}; 