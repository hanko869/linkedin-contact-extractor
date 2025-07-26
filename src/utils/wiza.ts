import { Contact, ExtractionResult } from '@/types/contact';
import { generateContactId } from './extraction';

// API Key management
const API_KEYS = [
  process.env.WIZA_API_KEY || 'c951d1f0b91ab7e5afe187fa747f3668524ad5e2eba2c68a912654b43682cab8',
  process.env.WIZA_API_KEY_2 || '2ac8378b7aa63804c7d7a57d7e9777600325895beb8410022529c70132bbf61b'
].filter(key => key && key.length > 0);

// Check if we're in development without proper API keys
const isDevelopment = process.env.NODE_ENV === 'development';
const hasRealApiKeys = process.env.WIZA_API_KEY || process.env.WIZA_API_KEY_2;

// API Key health tracking
interface ApiKeyHealth {
  key: string;
  index: number;
  isHealthy: boolean;
  lastChecked: number;
  consecutiveFailures: number;
  credits?: number;
}

// Track health status of each API key
const apiKeyHealthMap: Map<string, ApiKeyHealth> = new Map();

// Initialize health tracking for all keys
API_KEYS.forEach((key, index) => {
  apiKeyHealthMap.set(key, {
    key,
    index,
    isHealthy: true,
    lastChecked: 0,
    consecutiveFailures: 0
  });
});

// Health check interval (5 minutes)
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;

// Maximum consecutive failures before marking unhealthy
const MAX_CONSECUTIVE_FAILURES = 3;

// Get all healthy API keys
const getHealthyApiKeys = (): ApiKeyHealth[] => {
  return Array.from(apiKeyHealthMap.values()).filter(health => health.isHealthy);
};

// Mark API key as failed
const markApiKeyFailed = (apiKey: string) => {
  const health = apiKeyHealthMap.get(apiKey);
  if (health) {
    health.consecutiveFailures++;
    if (health.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      health.isHealthy = false;
      console.error(`API key index ${health.index} marked as unhealthy after ${MAX_CONSECUTIVE_FAILURES} failures`);
    }
  }
};

// Mark API key as successful
const markApiKeySuccess = (apiKey: string) => {
  const health = apiKeyHealthMap.get(apiKey);
  if (health) {
    health.consecutiveFailures = 0;
    health.isHealthy = true;
    health.lastChecked = Date.now();
  }
};

// Check if we should re-check a previously failed API key
const shouldRecheckApiKey = (health: ApiKeyHealth): boolean => {
  return !health.isHealthy && 
         (Date.now() - health.lastChecked) > HEALTH_CHECK_INTERVAL;
};

// Get the best API key to use (with failover support)
const getBestApiKey = (): string | null => {
  // First, check if any unhealthy keys should be rechecked
  for (const health of apiKeyHealthMap.values()) {
    if (shouldRecheckApiKey(health)) {
      health.isHealthy = true;
      health.consecutiveFailures = 0;
      console.log(`Re-enabling API key index ${health.index} for health check`);
    }
  }

  const healthyKeys = getHealthyApiKeys();
  if (healthyKeys.length === 0) {
    console.error('No healthy API keys available!');
    return null;
  }

  // Use the API key with the least recent usage
  healthyKeys.sort((a, b) => a.lastChecked - b.lastChecked);
  return healthyKeys[0].key;
};

// Execute with failover - tries each healthy API key until one succeeds
async function executeWithFailover<T>(
  operation: (apiKey: string) => Promise<T>,
  operationName: string
): Promise<T> {
  const healthyKeys = getHealthyApiKeys();
  
  if (healthyKeys.length === 0) {
    throw new Error('No healthy API keys available');
  }

  let lastError: any;
  
  for (const keyHealth of healthyKeys) {
    try {
      console.log(`Attempting ${operationName} with API key index ${keyHealth.index}`);
      const result = await operation(keyHealth.key);
      markApiKeySuccess(keyHealth.key);
      return result;
    } catch (error: any) {
      console.warn(`${operationName} failed with API key index ${keyHealth.index}:`, error.message || error);
      markApiKeyFailed(keyHealth.key);
      lastError = error;
      
      // Check if this is a credits/quota error
      if (error.message?.includes('credits') || 
          error.message?.includes('quota') || 
          error.message?.includes('limit') ||
          error.message?.includes('402')) {
        console.log(`API key index ${keyHealth.index} appears to be out of credits`);
      }
      
      // If this is a billing issue, stop immediately - don't retry with other keys
      if (error.message?.includes('billing')) {
        console.error('Billing issue detected - stopping all retries');
        throw new Error('Wiza account has a billing issue. Please check your Wiza account at https://wiza.co');
      }
      
      // If this is a network error, don't try other keys
      if (error.message?.includes('fetch failed') || 
          error.message?.includes('ECONNREFUSED')) {
        throw new Error('Network error - please check your internet connection');
      }
    }
  }
  
  throw lastError || new Error(`All API keys failed for ${operationName}`);
}

// Execute operations in parallel with multiple API keys
async function executeInParallel<T>(
  linkedinUrls: string[],
  operation: (url: string, apiKey: string) => Promise<T>
): Promise<Map<string, T>> {
  const results = new Map<string, T>();
  const healthyKeys = getHealthyApiKeys();
  
  if (healthyKeys.length === 0) {
    throw new Error('No healthy API keys available');
  }

  // Create a queue of URLs to process
  const urlQueue = [...linkedinUrls];
  const processingPromises: Promise<void>[] = [];

  // Process URLs in parallel using all healthy API keys
  for (const keyHealth of healthyKeys) {
    const processWithKey = async () => {
      while (urlQueue.length > 0) {
        const url = urlQueue.shift();
        if (!url) break;

        try {
          console.log(`Processing ${url} with API key index ${keyHealth.index}`);
          const result = await operation(url, keyHealth.key);
          results.set(url, result);
          markApiKeySuccess(keyHealth.key);
        } catch (error: any) {
          console.error(`Failed to process ${url} with API key index ${keyHealth.index}:`, error.message);
          markApiKeyFailed(keyHealth.key);
          
          // Put the URL back in the queue if API key failed
          if (getHealthyApiKeys().length > 0) {
            urlQueue.push(url);
          } else {
            throw new Error(`Failed to process ${url}: All API keys exhausted`);
          }
        }
      }
    };

    processingPromises.push(processWithKey());
  }

  // Wait for all parallel operations to complete
  await Promise.all(processingPromises);
  
  return results;
}

// Check Wiza API credits
export const checkWizaCredits = async (): Promise<any> => {
  return executeWithFailover(async (apiKey) => {
    const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';
    
    const response = await fetch(`${baseUrl}/api/meta/credits`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('Failed to check credits:', { status: response.status });
      
      // Don't throw for 402 (payment required) - just return null
      if (response.status === 402) {
        return { credits: { email_credits: 0, phone_credits: 0, api_credits: 0 } };
      }
      
      throw new Error(`Credit check failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('=== WIZA CREDITS CHECK ===');
    console.log(JSON.stringify(data, null, 2));
    console.log('=== END CREDITS CHECK ===');
    
    return data;
  }, 'checkWizaCredits');
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
  const apiKey = getBestApiKey();
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  if (!apiKey) {
    throw new Error('No healthy API keys available for list creation.');
  }

  console.log('Environment check:', {
    hasEnvApiKey: !!process.env.WIZA_API_KEY,
    envApiKeyLength: process.env.WIZA_API_KEY?.length,
    usingApiKey: !!apiKey,
    apiKeyLength: apiKey?.length
  });

  const username = extractLinkedInUsername(linkedinUrl);
  const listName = `Test-${username || 'Unknown'}-${Date.now()}`;

  // Correct payload format according to OpenAPI specification
  const payload = {
    list: {
      name: listName,
      enrichment_level: 'partial',  // Partial is faster
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
  const apiKey = getBestApiKey();
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  if (!apiKey) {
    throw new Error('No healthy API keys available for list status check.');
  }

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
  const apiKey = getBestApiKey();
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  if (!apiKey) {
    throw new Error('No healthy API keys available for contact retrieval.');
  }

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
  
  // Skip credit check during extraction to avoid API spam
  // Credits will be checked implicitly when we try to create the reveal

  // Use failover system for the extraction
  return executeWithFailover(async (apiKey) => {
    const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

    // Create Individual Reveal
    const payload = {
      individual_reveal: {
        profile_url: linkedinUrl
      },
      enrichment_level: 'partial',  // Partial is faster
      email_options: {
        accept_work: true,
        accept_personal: true
      }
    };

    console.log('Creating Individual Reveal with payload:', JSON.stringify(payload, null, 2));

    console.log('Making API request to:', `${baseUrl}/api/individual_reveals`);
    console.log('Using API key (first 10 chars):', apiKey.substring(0, 10) + '...');
    
    const response = await fetch(`${baseUrl}/api/individual_reveals`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload)
    });

          if (!response.ok) {
        const errorText = await response.text();
        console.warn('Individual Reveal creation failed:', { 
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText
        });
        
        // Check for specific error conditions
        if (response.status === 402 || errorText.includes('credits') || errorText.includes('quota')) {
          throw new Error(`API key out of credits`);
        }
        
        if (response.status === 401) {
          throw new Error(`Invalid API key`);
        }
        
        if (response.status === 403) {
          throw new Error(`Access forbidden - check API permissions`);
        }
        
        // Parse error message if possible
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.message || errorJson.error || `API error: ${response.status}`);
        } catch {
          throw new Error(`API error ${response.status}: ${errorText.substring(0, 100)}`);
        }
      }

    const revealResponse = await response.json();
    console.log('Individual Reveal created:', JSON.stringify(revealResponse, null, 2));
    
    // Wait for completion
    const revealId = revealResponse.data.id.toString();
    console.log(`Starting to poll for reveal ID: ${revealId}`);
    const maxWaitTime = 60000; // 1 minute max
    const pollInterval = 2000; // 2 seconds for faster polling
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

        const statusData = await statusResponse.json();
        console.log('Reveal status check:', {
          status: statusData.data?.status,
          is_complete: statusData.data?.is_complete,
          fail_error: statusData.data?.fail_error,
          id: statusData.data?.id
        });

        if (statusData.data?.is_complete === true) {
          console.log('Individual Reveal completed. Full data:', JSON.stringify(statusData.data, null, 2));
          
          // Check if the reveal failed but also check if we have data
          if (statusData.data?.status === 'failed') {
            const failError = statusData.data?.fail_error || 'Unknown error';
            console.error('Reveal marked as failed:', failError);
            
            // IMPORTANT: Check if we actually have contact data despite the "failed" status
            // Wiza sometimes returns data even with billing_issue status
            const hasContactData = statusData.data?.email || statusData.data?.phone_number || 
                                 statusData.data?.mobile_phone || statusData.data?.name ||
                                 statusData.data?.full_name;
            
            if (failError === 'billing_issue' && hasContactData) {
              console.warn('Wiza returned billing_issue but provided contact data - proceeding with extraction');
              // DO NOT throw error - continue processing the data below
            } else if (failError === 'profile_not_found') {
              throw new Error('LinkedIn profile not found. Please check the URL is correct.');
            } else if (failError === 'profile_private') {
              throw new Error('LinkedIn profile is private and cannot be accessed.');
            } else if (failError === 'billing_issue' && !hasContactData) {
              console.error('Wiza API returned billing_issue with no data. This could mean:');
              console.error('1. Your Wiza account is on a limited plan');
              console.error('2. This specific profile requires a higher-tier Wiza plan');
              console.error('3. You\'ve hit a rate limit');
              console.error('Full error data:', statusData.data);
              throw new Error('Wiza API limitation: This profile cannot be extracted with your current Wiza plan. Try a different profile or upgrade your Wiza account.');
            } else if (!hasContactData) {
              throw new Error(`Failed to extract contact: ${failError}`);
            } else {
              console.warn(`Reveal marked as failed with ${failError} but has data - continuing`);
            }
          }

          console.log('✅ Individual Reveal completed successfully!');
          console.log('Raw API response:', JSON.stringify(statusData, null, 2));

          // The contact data is directly in statusData.data
          const contact = statusData.data;
          
          // Check if we have any useful data
          if (!contact.email && !contact.mobile_phone && !contact.phone_number && !contact.name) {
            console.error('No contact information found in profile');
            throw new Error('No contact information available for this profile');
          }

          // Extract contact information
          const extractedContact: Contact = {
            id: generateContactId(),
            linkedinUrl: linkedinUrl,
            name: contact.full_name || contact.name || 'Unknown',
            jobTitle: contact.job_title || contact.headline || '',
            company: contact.job_company_name || contact.company || '',
            location: contact.location || '',
            email: contact.email || '',
            emails: [],
            phone: '',
            phones: [],
            extractedAt: new Date().toISOString()
          };

          // Handle emails - check all possible email fields
          const emailFields = [
            contact.email,
            contact.work_email,
            contact.personal_email,
            contact.likely_email,
            contact.emails?.[0]
          ];

          for (const email of emailFields) {
            if (email && typeof email === 'string' && extractedContact.emails && !extractedContact.emails.includes(email)) {
              extractedContact.emails.push(email);
            }
          }

          // Set primary email
          if (extractedContact.emails && extractedContact.emails.length > 0) {
            extractedContact.email = extractedContact.emails[0];
          }

          // Handle phones - check all possible phone fields
          const phoneFields = [
            contact.phone_number,
            contact.phone,
            contact.mobile_phone,
            contact.work_phone,
            contact.personal_phone,
            contact.phones?.[0]
          ];

          for (const phone of phoneFields) {
            if (phone && typeof phone === 'string' && extractedContact.phones && !extractedContact.phones.includes(phone)) {
              extractedContact.phones.push(phone);
            }
          }

          // Set primary phone
          if (extractedContact.phones && extractedContact.phones.length > 0) {
            extractedContact.phone = extractedContact.phones[0];
          }

          console.log('📞 Phone extraction:', {
            found_phones: extractedContact.phones,
            raw_phone_fields: {
              phone_number: contact.phone_number,
              phone: contact.phone,
              mobile_phone: contact.mobile_phone,
              work_phone: contact.work_phone
            }
          });

          console.log('✅ Successfully extracted contact:', {
            name: extractedContact.name,
            emails: extractedContact.emails,
            phones: extractedContact.phones,
            location: extractedContact.location
          });

          return {
            success: true,
            contact: extractedContact
          };
        } else if (statusData.data?.status === 'failed' && statusData.data?.is_complete === true) {
          // Only throw error if the reveal is complete AND failed
          throw new Error('Individual Reveal failed: ' + (statusData.data?.fail_error || statusData.data?.error || 'Unknown error'));
        } else if (statusData.data?.status === 'failed' && statusData.data?.fail_error === 'billing_issue') {
          // If we see billing_issue but it's not complete yet, log it and keep polling
          console.warn('Transient billing_issue during processing - continuing to poll...');
        }

        // Still processing, wait and try again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (pollError) {
        console.error('Error polling reveal status:', pollError);
        // Continue polling despite errors
      }
    }

    throw new Error('Extraction timed out after 1 minute. Please try again.');
  }, 'extractContactWithWiza');
};

// Individual Reveal API - Alternative approach for better contact data
const createIndividualReveal = async (linkedinUrl: string): Promise<any> => {
  const apiKey = getBestApiKey();
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  if (!apiKey) {
    throw new Error('No healthy API keys available for individual reveal.');
  }

  const payload = {
    individual_reveal: {
      profile_url: linkedinUrl
    },
    enrichment_level: 'partial', // Partial is faster
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
  const apiKey = getBestApiKey();
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  if (!apiKey) {
    throw new Error('No healthy API keys available for reveal status check.');
  }

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
  const apiKey = getBestApiKey();
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  if (!apiKey) {
    throw new Error('No healthy API keys available for prospect search.');
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
  const apiKey = getBestApiKey();
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  if (!apiKey) {
    throw new Error('No healthy API keys available for prospect list creation.');
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

// Bulk extraction with parallel processing using multiple API keys
export const extractContactsInParallel = async (linkedinUrls: string[]): Promise<Map<string, ExtractionResult>> => {
  console.log(`Starting parallel extraction for ${linkedinUrls.length} LinkedIn URLs`);
  console.log(`Available healthy API keys: ${getHealthyApiKeys().length}`);
  
  if (linkedinUrls.length === 0) {
    return new Map();
  }

  // First validate all URLs
  const validUrls = linkedinUrls.filter(url => url && url.includes('linkedin.com/in/'));
  const invalidUrls = linkedinUrls.filter(url => !url || !url.includes('linkedin.com/in/'));

  if (invalidUrls.length > 0) {
    console.warn(`Skipping ${invalidUrls.length} invalid URLs:`, invalidUrls);
  }

  if (validUrls.length === 0) {
    console.error('No valid LinkedIn URLs to process');
    return new Map();
  }

  try {
    // Use the parallel processing system
    const results = await executeInParallel(validUrls, async (linkedinUrl, apiKey) => {
      const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

      // Create Individual Reveal for this URL
      const payload = {
        individual_reveal: {
          profile_url: linkedinUrl
        },
        enrichment_level: 'partial',  // Partial is faster
        email_options: {
          accept_work: true,
          accept_personal: true
        }
      };

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
        if (errorText.includes('credits') || errorText.includes('quota')) {
          throw new Error(`API key out of credits`);
        }
        throw new Error(`Failed to create reveal: ${response.status}`);
      }

      const revealResponse = await response.json();
      const revealId = revealResponse.data.id.toString();
      
      // Poll for completion
      const maxWaitTime = 180000; // 3 minutes
      const pollInterval = 5000; // 5 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        const statusResponse = await fetch(`${baseUrl}/api/individual_reveals/${revealId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          }
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          
          if (statusData.data?.status === 'finished') {
            const contact = statusData.data?.contact;
            if (!contact) {
              return {
                success: false,
                error: 'No contact data in response'
              };
            }

            // Extract contact information (same logic as single extraction)
            const extractedContact: Contact = {
              id: generateContactId(),
              linkedinUrl: linkedinUrl,
              name: contact.full_name || contact.name || 'Unknown',
              jobTitle: contact.job_title || contact.headline || '',
              company: contact.job_company_name || contact.company || '',
              location: contact.location || '',
              email: '',
              emails: [],
              phone: '',
              phones: [],
              extractedAt: new Date().toISOString()
            };

            // Extract emails
            const emailFields = [contact.email, contact.work_email, contact.personal_email];
            for (const email of emailFields) {
              if (email && extractedContact.emails && !extractedContact.emails.includes(email)) {
                extractedContact.emails.push(email);
              }
            }
            if (extractedContact.emails && extractedContact.emails.length > 0) {
              extractedContact.email = extractedContact.emails[0];
            }

            // Extract phones
            const phoneFields = [contact.phone_number, contact.phone, contact.mobile_phone];
            for (const phone of phoneFields) {
              if (phone && extractedContact.phones && !extractedContact.phones.includes(phone)) {
                extractedContact.phones.push(phone);
              }
            }
            if (extractedContact.phones && extractedContact.phones.length > 0) {
              extractedContact.phone = extractedContact.phones[0];
            }

            return {
              success: true,
              contact: extractedContact
            };
          } else if (statusData.data?.status === 'failed') {
            return {
              success: false,
              error: 'Reveal failed: ' + (statusData.data?.error || 'Unknown error')
            };
          }
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      return {
        success: false,
        error: 'Extraction timed out'
      };
    });

    // Convert Map to extraction results
    const extractionResults = new Map<string, ExtractionResult>();
    
    for (const [url, result] of results) {
      extractionResults.set(url, result);
    }

    // Add failed URLs
    for (const url of invalidUrls) {
      extractionResults.set(url, {
        success: false,
        error: 'Invalid LinkedIn URL format'
      });
    }

    console.log(`Parallel extraction completed: ${extractionResults.size} results`);
    return extractionResults;

  } catch (error) {
    console.error('Parallel extraction failed:', error);
    throw error;
  }
};

// Get current API key health status
export const getApiKeyHealthStatus = (): { total: number; healthy: number; status: ApiKeyHealth[] } => {
  const allKeys = Array.from(apiKeyHealthMap.values());
  const healthyKeys = getHealthyApiKeys();
  
  return {
    total: allKeys.length,
    healthy: healthyKeys.length,
    status: allKeys.map(key => ({
      ...key,
      key: key.key.substring(0, 8) + '...' // Mask the API key for security
    }))
  };
}; 