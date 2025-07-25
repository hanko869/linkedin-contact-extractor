import { Contact, ExtractionResult } from '@/types/contact';
import { generateContactId } from './extraction';

// API Key management
const API_KEYS = [
  process.env.WIZA_API_KEY || 'c951d1f0b91ab7e5afe187fa747f3668524ad5e2eba2c68a912654b43682cab8',
  process.env.WIZA_API_KEY_2 || '2ac8378b7aa63804c7d7a57d7e9777600325895beb8410022529c70132bbf61b'
].filter(key => key && key.length > 0);

// Round-robin counter
let currentKeyIndex = 0;

// Get next API key using round-robin
const getNextApiKey = (): string => {
  const apiKey = API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  console.log(`Using API key index ${currentKeyIndex} of ${API_KEYS.length} keys`);
  return apiKey;
};

// Get a specific API key by index (for retries)
const getApiKeyByIndex = (index: number): string => {
  return API_KEYS[index % API_KEYS.length];
};

// Check Wiza API credits
export const checkWizaCredits = async (): Promise<any> => {
  const apiKey = getNextApiKey();
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  try {
    const response = await fetch(`${baseUrl}/api/meta/credits`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to check credits:', { status: response.status, error: errorText });
      return null;
    }

    const data = await response.json();
    console.log('=== WIZA CREDITS CHECK ===');
    console.log(JSON.stringify(data, null, 2));
    console.log('=== END CREDITS CHECK ===');
    
    return data;
  } catch (error) {
    console.error('Error checking Wiza credits:', error);
    return null;
  }
};

// Wiza API response interfaces (corrected based on OpenAPI spec)
interface WizaListResponse {
  status: {
    code: number;
    message: string;
  };
  type: string;
  data: {
    id: number; // ID is an integer, not string
    name: string;
    status: string; // 'queued', 'in_progress', 'completed', 'failed'
    stats?: {
      people: number;
      credits?: any;
    };
    finished_at?: string;
    created_at?: string;
    enrichment_level?: string;
    email_options?: any;
    report_type?: string;
  };
}

interface WizaListStatusResponse {
  status: {
    code: number;
    message: string;
  };
  type: string;
  data: {
    id: number;
    name: string;
    status: string; // 'queued', 'in_progress', 'completed', 'failed'
    stats: {
      people: number;
      credits?: any;
    };
    finished_at?: string;
    created_at?: string;
  };
}

interface WizaContact {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  email_status?: string;
  email_type?: string;
  title?: string;
  location?: string;
  linkedin?: string;
  domain?: string;
  phone_number?: string;  // New field name from API
  mobile_phone?: string;  // New field name from API
  phone_number1?: string;
  phone_number2?: string;
  phone_number3?: string;
  mobile_phone1?: string;
  personal_email?: string;  // New field name from API
  personal_email1?: string;
  company?: string;
  company_domain?: string;
  company_industry?: string;
  company_size?: string;
  // Allow any other properties for debugging
  [key: string]: any;
}

interface WizaContactsResponse {
  status: {
    code: number;
    message: string;
  };
  data: WizaContact[];
}

// Prospect search interfaces
interface ProspectSearchFilters {
  first_name?: string[];
  last_name?: string[];
  job_title?: Array<{
    v: string;
    s: 'i' | 'e'; // include or exclude
  }>;
  location?: Array<{
    v: string;
    b: 'city' | 'state' | 'country';
    s: 'i' | 'e';
  }>;
}

interface ProspectProfile {
  full_name: string;
  linkedin_url: string;
  industry?: string;
  job_title?: string;
  job_title_role?: string;
  job_title_sub_role?: string;
  job_company_name?: string;
  job_company_website?: string;
  location_name?: string;
}

interface ProspectSearchResponse {
  status: {
    code: number;
    message: string;
  };
  data: {
    total: number;
    profiles: ProspectProfile[];
  };
}

interface ProspectListResponse {
  status: {
    code: number;
    message: string;
  };
  type: string;
  data: {
    id: number;
    name: string;
    status: string;
    stats?: {
      people: number;
    };
  };
}

// Extract LinkedIn username from URL for naming
const extractLinkedInUsername = (url: string): string | null => {
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  return match ? match[1] : null;
};

// Create a list with LinkedIn URL
const createWizaList = async (linkedinUrl: string): Promise<WizaListResponse> => {
  // Use round-robin API key selection
  const apiKey = getNextApiKey();
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  console.log('Environment check:', {
    hasEnvApiKey: !!process.env.WIZA_API_KEY,
    envApiKeyLength: process.env.WIZA_API_KEY?.length,
    usingApiKey: !!apiKey,
    apiKeyLength: apiKey?.length
  });

  if (!apiKey) {
    throw new Error('Wiza API key not configured');
  }

  const username = extractLinkedInUsername(linkedinUrl);
  const listName = `Test-${username || 'Unknown'}-${Date.now()}`;

  // Correct payload format according to OpenAPI specification
  const payload = {
    list: {
      name: listName,
      enrichment_level: 'full',  // Changed to 'full' to get phone numbers
      email_options: {
        accept_work: true,
        accept_personal: true,
        accept_generic: false
      },
      items: [
        {
          profile_url: linkedinUrl // Correct field name from OpenAPI spec
        }
      ]
    }
  };

  console.log('Creating Wiza list with correct format:', JSON.stringify(payload, null, 2));

  const response = await fetch(`${baseUrl}/api/lists`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  console.log('Wiza API Response Status:', response.status, response.statusText);

  // Get detailed response information
  const responseHeaders = Object.fromEntries(response.headers.entries());
  console.log('Response headers:', responseHeaders);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Wiza list creation failed:', { 
      status: response.status, 
      statusText: response.statusText,
      error: errorText,
      headers: responseHeaders,
      url: response.url,
      apiKeyPrefix: apiKey.substring(0, 8) + '...',
      sentPayload: payload
    });

    // Try to parse error response
    let parsedError;
    try {
      parsedError = JSON.parse(errorText);
      console.log('Parsed error response:', parsedError);
    } catch (e) {
      console.log('Error response is not JSON:', errorText);
      parsedError = errorText;
    }

    // Check for specific error cases
    if (response.status === 401) {
      throw new Error(`Authentication failed: API access may not be enabled for your Wiza account. Please contact hello@wiza.co to enable API access, then try again.`);
    }

    if (response.status === 400) {
      const errorDetails = typeof parsedError === 'object' ? JSON.stringify(parsedError) : parsedError;
      throw new Error(`Bad request: ${errorDetails} - The request format has been corrected according to Wiza's OpenAPI specification.`);
    }

    if (response.status === 403) {
      throw new Error(`Forbidden: Your API key may not have sufficient permissions. Please contact hello@wiza.co to verify your API access level.`);
    }

    throw new Error(`Failed to create Wiza list: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
  }

  const data: WizaListResponse = await response.json();
  console.log('Wiza list created successfully:', data);
  return data;
};

// Check list status
const checkWizaListStatus = async (listId: string): Promise<WizaListStatusResponse> => {
  const apiKey = process.env.WIZA_API_KEY || 'c951d1f0b91ab7e5afe187fa747f3668524ad5e2eba2c68a912654b43682cab8';
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  const response = await fetch(`${baseUrl}/api/lists/${listId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to check list status: ${response.status} ${errorText}`);
  }

  return await response.json();
};

// Get contacts from completed list
const getWizaContacts = async (listId: string): Promise<WizaContactsResponse> => {
  const apiKey = process.env.WIZA_API_KEY || 'c951d1f0b91ab7e5afe187fa747f3668524ad5e2eba2c68a912654b43682cab8';
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  const response = await fetch(`${baseUrl}/api/lists/${listId}/contacts?segment=people`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log('Contacts API error:', { status: response.status, error: errorText });
    
    // Handle specific "No contacts to export" error
    if (response.status === 400 && errorText.includes('No contacts to export')) {
      throw new Error('PROFILE_FOUND_NO_CONTACTS');
    }
    
    throw new Error(`Failed to get contacts: ${response.status} ${errorText}`);
  }

  return await response.json();
};

// Wait for list to complete with polling (increased timeout)
const waitForListCompletion = async (listId: string, maxWaitTime = 180000): Promise<WizaListStatusResponse> => {
  const startTime = Date.now();
  const pollInterval = 5000; // Poll every 5 seconds (increased from 3)

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const status = await checkWizaListStatus(listId);
      console.log('List status:', { status: status.data.status, message: status.status.message });

      if (status.data.status === 'finished') {
        return status;
      }

      if (status.data.status === 'failed') {
        throw new Error('List processing failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.log('List status check error:', error);
      // Continue polling even if individual checks fail (might be temporary)
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error('List processing timeout - please try again (extended timeout: 3 minutes)');
};

// Main function to extract contact from LinkedIn URL
export const extractContactWithWiza = async (linkedinUrl: string): Promise<ExtractionResult> => {
  console.log('Starting Wiza contact extraction for:', linkedinUrl);
  console.log('📱 IMPORTANT: Using Individual Reveal API for complete contact data (including phone numbers)');
  
  // Check available credits first
  const credits = await checkWizaCredits();
  if (credits && credits.credits) {
    console.log('Available Wiza credits:', {
      email_credits: credits.credits.email_credits,
      phone_credits: credits.credits.phone_credits,
      api_credits: credits.credits.api_credits
    });
    
    // Check if user has phone credits
    if (credits.credits.phone_credits === 0 || credits.credits.phone_credits === '0') {
      console.warn('⚠️ WARNING: You have 0 phone credits. Phone numbers will not be returned.');
      console.warn('⚠️ To get phone numbers, you need to add phone credits to your Wiza account.');
    }
  }
  
  // The Wiza bulk list contacts API (/api/lists/{id}/contacts) does NOT return phone fields
  // according to the OpenAPI specification. Only the Individual Reveal API returns phone numbers.
  // So we go directly to Individual Reveal for complete contact information.
  
  try {
    // Skip the bulk list API entirely and use Individual Reveal
    const apiKey = getNextApiKey();
    const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

    // Create Individual Reveal
    const payload = {
      individual_reveal: {
        profile_url: linkedinUrl
      },
      enrichment_level: 'full',
      email_options: {
        accept_work: true,
        accept_personal: true
      }
    };

    console.log('Creating Individual Reveal with payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${baseUrl}/api/individual_reveals`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Individual Reveal creation failed:', { 
        status: response.status, 
        error: errorText
      });
      throw new Error(`Failed to create individual reveal: ${response.status} ${errorText}`);
    }

    const revealResponse = await response.json();
    console.log('Individual Reveal created:', revealResponse);
    
    // Wait for completion
    const revealId = revealResponse.data.id.toString();
    const maxWaitTime = 180000; // 3 minutes
    const pollInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const statusResponse = await fetch(`${baseUrl}/api/individual_reveals/${revealId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          }
        });

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          throw new Error(`Failed to check reveal status: ${statusResponse.status} ${errorText}`);
        }

        const status = await statusResponse.json();
        console.log('Individual Reveal status:', { 
          status: status.data.status, 
          isComplete: status.data.is_complete 
        });

        if (status.data.is_complete) {
          console.log('=== INDIVIDUAL REVEAL COMPLETE OBJECT ===');
          console.log(JSON.stringify(status.data, null, 2));
          console.log('=== END INDIVIDUAL REVEAL OBJECT ===');

          // Extract ALL emails
          const allEmails: string[] = [];
          
          // Add primary email if exists
          if (status.data.email) {
            allEmails.push(status.data.email);
          }
          
          // Add all emails from emails array
          if (status.data.emails && Array.isArray(status.data.emails)) {
            status.data.emails.forEach((emailObj: any) => {
              if (emailObj.email && !allEmails.includes(emailObj.email)) {
                allEmails.push(emailObj.email);
              }
            });
          }
          
          console.log('All emails found:', allEmails);
          
          // Extract ALL phone numbers
          const allPhones: string[] = [];
          
          // Add primary phone fields if they exist
          if (status.data.mobile_phone) {
            allPhones.push(status.data.mobile_phone);
          }
          if (status.data.phone_number && !allPhones.includes(status.data.phone_number)) {
            allPhones.push(status.data.phone_number);
          }
          
          // Add all phones from phones array
          if (status.data.phones && Array.isArray(status.data.phones)) {
            status.data.phones.forEach((phoneObj: any) => {
              const phoneNum = phoneObj.number || phoneObj.pretty_number;
              if (phoneNum && !allPhones.includes(phoneNum)) {
                allPhones.push(phoneNum);
              }
            });
          }
          
          console.log('All phones found:', allPhones);
          
          // Debug: Log all phone-related fields
          console.log('Phone field debugging:', {
            mobile_phone: status.data.mobile_phone,
            phone_number: status.data.phone_number,
            phones: status.data.phones,
            phone_status: status.data.phone_status,
            hasPhones: !!status.data.phones,
            phonesLength: status.data.phones?.length || 0,
            enrichmentLevel: status.data.enrichment_level
          });

          // Extract contact information directly from reveal data
          const contact: Contact = {
            id: generateContactId(),
            linkedinUrl,
            name: status.data.name || 'Unknown Contact',
            email: allEmails[0], // Primary email for backward compatibility
            emails: allEmails.length > 0 ? allEmails : undefined,
            phone: allPhones[0], // Primary phone for backward compatibility
            phones: allPhones.length > 0 ? allPhones : undefined,
            extractedAt: new Date().toISOString(),
            jobTitle: status.data.title,
            company: status.data.company,
            location: status.data.location
          };

          console.log('Individual Reveal Contact created:', {
            id: contact.id,
            name: contact.name,
            hasEmail: !!contact.email,
            hasPhone: !!contact.phone,
            email: contact.email,
            phone: contact.phone
          });

          if (!contact.email && !contact.phone) {
            return {
              success: false,
              error: 'Profile found but no contact information returned. Your Wiza API key may not have phone access permissions. Check console logs for detailed API response.'
            };
          }

          // Log credits used if available
          if (status.data.credits) {
            console.log('Credits used:', status.data.credits);
          }

          return {
            success: true,
            contact
          };
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.log('Individual Reveal status check error:', error);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error('Individual Reveal processing timeout');

  } catch (error) {
    console.error('Individual Reveal API error:', error);
    return {
      success: false,
      error: `Individual Reveal failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
  
  /* ORIGINAL BULK LIST CODE BELOW - KEEPING FOR REFERENCE BUT NOT USING
  try {
    console.log('Starting Wiza contact extraction for:', linkedinUrl);

    // Step 1: Try bulk list API first
    const listResponse = await createWizaList(linkedinUrl);
    const completedStatus = await waitForListCompletion(listResponse.data.id.toString());

    // Step 3: Try to get contacts from bulk list
    try {
      const contactsResponse = await getWizaContacts(listResponse.data.id.toString());
      
      if (!contactsResponse.data || contactsResponse.data.length === 0) {
        console.log('🔄 No contact data from bulk list, trying Individual Reveal API...');
        return await extractContactWithWizaIndividual(linkedinUrl);
      }

      const wizaContact = contactsResponse.data[0];
      
      // DEBUG: Log the complete contact object to see actual field names
      console.log('=== FULL WIZA CONTACT OBJECT (BULK LIST) ===');
      console.log(JSON.stringify(wizaContact, null, 2));
      console.log('=== END CONTACT OBJECT ===');
      
      const primaryEmail = wizaContact.email || wizaContact.personal_email1 || wizaContact.personal_email;
      const primaryPhone = wizaContact.phone_number || wizaContact.mobile_phone || wizaContact.phone_number1 || wizaContact.mobile_phone1 || wizaContact.phone_number2;
      
      console.log('Bulk List Contact data extracted:', {
        name: wizaContact.full_name,
        email: primaryEmail,
        phone: primaryPhone,
        emailStatus: wizaContact.email_status,
        emailType: wizaContact.email_type,
        title: wizaContact.title,
        company: wizaContact.company
      });

      // If bulk list didn't find contact info, try Individual Reveal
      if ((!primaryEmail && !primaryPhone) || wizaContact.email_status === 'unfound') {
        console.log('🔄 Bulk list found profile but no contact info (email_status: unfound), trying Individual Reveal API...');
        return await extractContactWithWizaIndividual(linkedinUrl);
      }

      // Step 4: Create contact object from bulk list data
      const contact: Contact = {
        id: generateContactId(),
        linkedinUrl,
        name: wizaContact.full_name || `${wizaContact.first_name} ${wizaContact.last_name}`.trim() || 'Unknown Contact',
        email: primaryEmail,
        phone: primaryPhone,
        extractedAt: new Date().toISOString(),
        jobTitle: wizaContact.title,
        company: wizaContact.company,
        location: wizaContact.location
      };

      console.log('Bulk List Contact created successfully:', {
        id: contact.id,
        name: contact.name,
        hasEmail: !!contact.email,
        hasPhone: !!contact.phone,
        jobTitle: contact.jobTitle,
        company: contact.company
      });

      return {
        success: true,
        contact
      };

    } catch (contactError: unknown) {
      if (contactError instanceof Error && contactError.message === 'PROFILE_FOUND_NO_CONTACTS') {
        console.log('🔄 Bulk list API returned "no contacts to export", trying Individual Reveal API...');
        return await extractContactWithWizaIndividual(linkedinUrl);
      }
      if (contactError instanceof Error) {
        throw contactError;
      }
      throw new Error('Unknown error occurred');
    }

  } catch (error) {
    console.error('Wiza API error:', error);
    
    // If bulk list API failed completely, try Individual Reveal as last resort
    if (error instanceof Error && (
      error.message.includes('timeout') || 
      error.message.includes('failed') ||
      error.message.includes('400')
    )) {
      console.log('🔄 Bulk list API failed, trying Individual Reveal API as fallback...');
      return await extractContactWithWizaIndividual(linkedinUrl);
    }
    
    let errorMessage = 'An unexpected error occurred while extracting contact information.';
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'Wiza API key not configured or invalid. Please check your API credentials.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timeout. The contact extraction is taking longer than expected. Please try again.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Authentication failed. Please verify your Wiza API key.';
      } else if (error.message.includes('429')) {
        errorMessage = 'Rate limit exceeded. Please try again in a few minutes.';
      } else if (error.message.includes('400')) {
        errorMessage = 'Invalid LinkedIn URL format. Please ensure you\'re using a valid LinkedIn profile URL.';
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
  */
};

// Individual Reveal API - Alternative approach for better contact data
const createIndividualReveal = async (linkedinUrl: string): Promise<any> => {
  const apiKey = getNextApiKey();
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  const payload = {
    individual_reveal: {
      profile_url: linkedinUrl
    },
    enrichment_level: 'full', // Try full instead of partial
    email_options: {
      accept_work: true,
      accept_personal: true
    }
  };

  console.log('Creating Individual Reveal with payload:', JSON.stringify(payload, null, 2));

  const response = await fetch(`${baseUrl}/api/individual_reveals`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Individual Reveal creation failed:', { 
      status: response.status, 
      error: errorText
    });
    throw new Error(`Failed to create individual reveal: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log('Individual Reveal created:', data);
  return data;
};

// Check Individual Reveal status
const checkIndividualRevealStatus = async (revealId: string): Promise<any> => {
  const apiKey = process.env.WIZA_API_KEY || 'c951d1f0b91ab7e5afe187fa747f3668524ad5e2eba2c68a912654b43682cab8';
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  const response = await fetch(`${baseUrl}/api/individual_reveals/${revealId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to check reveal status: ${response.status} ${errorText}`);
  }

  return await response.json();
};

// Alternative extraction using Individual Reveal API
export const extractContactWithWizaIndividual = async (linkedinUrl: string): Promise<ExtractionResult> => {
  try {
    console.log('🔄 Trying Individual Reveal API for:', linkedinUrl);

    // Step 1: Create individual reveal
    const revealResponse = await createIndividualReveal(linkedinUrl);
    
    // Step 2: Wait for completion
    const revealId = revealResponse.data.id.toString();
    const maxWaitTime = 180000; // 3 minutes (increased timeout)
    const pollInterval = 5000; // 5 seconds (consistent with list polling)
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await checkIndividualRevealStatus(revealId);
        console.log('Individual Reveal status:', { 
          status: status.data.status, 
          isComplete: status.data.is_complete 
        });

        if (status.data.is_complete) {
          console.log('=== INDIVIDUAL REVEAL COMPLETE OBJECT ===');
          console.log(JSON.stringify(status.data, null, 2));
          console.log('=== END INDIVIDUAL REVEAL OBJECT ===');

          // Extract ALL emails
          const allEmails: string[] = [];
          
          // Add primary email if exists
          if (status.data.email) {
            allEmails.push(status.data.email);
          }
          
          // Add all emails from emails array
          if (status.data.emails && Array.isArray(status.data.emails)) {
            status.data.emails.forEach((emailObj: any) => {
              if (emailObj.email && !allEmails.includes(emailObj.email)) {
                allEmails.push(emailObj.email);
              }
            });
          }
          
          console.log('All emails found:', allEmails);
          
          // Extract ALL phone numbers
          const allPhones: string[] = [];
          
          // Add primary phone fields if they exist
          if (status.data.mobile_phone) {
            allPhones.push(status.data.mobile_phone);
          }
          if (status.data.phone_number && !allPhones.includes(status.data.phone_number)) {
            allPhones.push(status.data.phone_number);
          }
          
          // Add all phones from phones array
          if (status.data.phones && Array.isArray(status.data.phones)) {
            status.data.phones.forEach((phoneObj: any) => {
              const phoneNum = phoneObj.number || phoneObj.pretty_number;
              if (phoneNum && !allPhones.includes(phoneNum)) {
                allPhones.push(phoneNum);
              }
            });
          }
          
          console.log('All phones found:', allPhones);
          
          // Debug: Log all phone-related fields
          console.log('Phone field debugging:', {
            mobile_phone: status.data.mobile_phone,
            phone_number: status.data.phone_number,
            phones: status.data.phones,
            phone_status: status.data.phone_status,
            hasPhones: !!status.data.phones,
            phonesLength: status.data.phones?.length || 0,
            enrichmentLevel: status.data.enrichment_level
          });

          // Extract contact information directly from reveal data
          const contact: Contact = {
            id: generateContactId(),
            linkedinUrl,
            name: status.data.name || 'Unknown Contact',
            email: allEmails[0], // Primary email for backward compatibility
            emails: allEmails.length > 0 ? allEmails : undefined,
            phone: allPhones[0], // Primary phone for backward compatibility
            phones: allPhones.length > 0 ? allPhones : undefined,
            extractedAt: new Date().toISOString(),
            jobTitle: status.data.title,
            company: status.data.company,
            location: status.data.location
          };

          console.log('Individual Reveal Contact created:', {
            id: contact.id,
            name: contact.name,
            hasEmail: !!contact.email,
            hasPhone: !!contact.phone,
            email: contact.email,
            phone: contact.phone
          });

          if (!contact.email && !contact.phone) {
            return {
              success: false,
              error: 'Profile found but no contact information returned. Your Wiza API key may not have phone access permissions. Check console logs for detailed API response.'
            };
          }

          return {
            success: true,
            contact
          };
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.log('Individual Reveal status check error:', error);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error('Individual Reveal processing timeout');

  } catch (error) {
    console.error('Individual Reveal API error:', error);
    return {
      success: false,
      error: `Individual Reveal failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

// Search for prospects
export const searchProspects = async (
  firstName?: string,
  lastName?: string,
  jobTitle?: string,
  location?: string,
  size: number = 20
): Promise<ProspectSearchResponse> => {
  const apiKey = getNextApiKey();
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  if (!apiKey) {
    throw new Error('Wiza API key not configured');
  }

  // Build filters object
  const filters: ProspectSearchFilters = {};

  if (firstName) {
    filters.first_name = [firstName.trim()];
  }

  if (lastName) {
    filters.last_name = [lastName.trim()];
  }

  if (jobTitle) {
    filters.job_title = [{
      v: jobTitle.trim(),
      s: 'i' // include
    }];
  }

  if (location) {
    // Parse location format and determine type
    const locationValue = location.trim();
    const parts = locationValue.split(',').map(p => p.trim());
    
    let locationType: 'city' | 'state' | 'country';
    let formattedLocation: string;
    
    if (parts.length >= 3) {
      // Format: "city, state, country" - use as city
      locationType = 'city';
      formattedLocation = locationValue;
    } else if (parts.length === 2) {
      // Format: "state, country" - treat as state
      locationType = 'state';
      formattedLocation = locationValue;
    } else {
      // Single part - could be country or incomplete city
      // For safety, treat as country to avoid format errors
      locationType = 'country';
      formattedLocation = locationValue;
    }
    
    filters.location = [{
      v: formattedLocation,
      b: locationType,
      s: 'i'
    }];
    
    console.log('Location parsed:', { 
      input: location, 
      formatted: formattedLocation, 
      type: locationType 
    });
  }

  const payload = {
    size,
    filters
  };

  console.log('Searching prospects with payload:', JSON.stringify(payload, null, 2));

  const response = await fetch(`${baseUrl}/api/prospects/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Prospect search failed:', { 
      status: response.status, 
      error: errorText
    });
    throw new Error(`Failed to search prospects: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log('Prospect search completed:', { 
    total: data.data?.total || 0,
    profiles: data.data?.profiles?.length || 0
  });
  
  return data;
};

// Create prospect list for contact extraction
export const createProspectList = async (
  firstName?: string,
  lastName?: string,
  jobTitle?: string,
  location?: string,
  maxProfiles: number = 20
): Promise<ProspectListResponse> => {
  const apiKey = process.env.WIZA_API_KEY || 'c951d1f0b91ab7e5afe187fa747f3668524ad5e2eba2c68a912654b43682cab8';
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  if (!apiKey) {
    throw new Error('Wiza API key not configured');
  }

  // Build filters object (same as search)
  const filters: ProspectSearchFilters = {};

  if (firstName) {
    filters.first_name = [firstName.trim()];
  }

  if (lastName) {
    filters.last_name = [lastName.trim()];
  }

  if (jobTitle) {
    filters.job_title = [{
      v: jobTitle.trim(),
      s: 'i'
    }];
  }

  if (location) {
    // Parse location format and determine type (same logic as searchProspects)
    const locationValue = location.trim();
    const parts = locationValue.split(',').map(p => p.trim());
    
    let locationType: 'city' | 'state' | 'country';
    let formattedLocation: string;
    
    if (parts.length >= 3) {
      // Format: "city, state, country" - use as city
      locationType = 'city';
      formattedLocation = locationValue;
    } else if (parts.length === 2) {
      // Format: "state, country" - treat as state
      locationType = 'state';
      formattedLocation = locationValue;
    } else {
      // Single part - could be country or incomplete city
      // For safety, treat as country to avoid format errors
      locationType = 'country';
      formattedLocation = locationValue;
    }
    
    filters.location = [{
      v: formattedLocation,
      b: locationType,
      s: 'i'
    }];
    
    console.log('Prospect List - Location parsed:', { 
      input: location, 
      formatted: formattedLocation, 
      type: locationType 
    });
  }

  const listName = `Prospect Search - ${firstName || ''} ${lastName || ''} - ${jobTitle || ''} - ${Date.now()}`.trim();

  const payload = {
    list: {
      name: listName,
      max_profiles: maxProfiles,
      enrichment_level: 'partial',
      email_options: {
        accept_work: true,
        accept_personal: true,
        accept_generic: false
      }
    },
    filters
  };

  console.log('Creating prospect list with payload:', JSON.stringify(payload, null, 2));

  const response = await fetch(`${baseUrl}/api/prospects/create_prospect_list`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Prospect list creation failed:', { 
      status: response.status, 
      error: errorText
    });
    throw new Error(`Failed to create prospect list: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log('Prospect list created:', data);
  
  return data;
}; 