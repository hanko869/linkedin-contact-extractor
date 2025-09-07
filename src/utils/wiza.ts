import { Contact, ExtractionResult } from '@/types/contact';
import { generateContactId } from './extraction';

// API Key management (dynamic: load all env vars starting with WIZA_API_KEY)
const API_KEYS = Object.keys(process.env)
  .filter((key) => key === 'WIZA_API_KEY' || key.startsWith('WIZA_API_KEY_'))
  .map((key) => (process.env as Record<string, string | undefined>)[key])
  .filter((val): val is string => typeof val === 'string' && val.length > 0);

console.log(`🔑 Initialized with ${API_KEYS.length} Wiza API keys`);
// Don't log API keys for security

// Check if we're in development without proper API keys
const isDevelopment = process.env.NODE_ENV === 'development';

// Export helper to report configured API key count without exposing values
export const getConfiguredWizaApiKeyCount = (): number => API_KEYS.length;

// Export helper to get all API keys for parallel processing
export const getAllApiKeys = (): string[] => [...API_KEYS];

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

// Per-key concurrency and rate limit handling
const CONCURRENCY_PER_KEY: number = Number(process.env.WIZA_CONCURRENCY_PER_KEY || '2');
const RATE_LIMIT_COOLDOWN_MS: number = Number(process.env.WIZA_RATE_LIMIT_COOLDOWN_MS || '10000');
const keyCooldownUntil: Map<string, number> = new Map();

// Initialize health tracking for all keys
API_KEYS.forEach((key, index) => {
  apiKeyHealthMap.set(key, {
    key,
    index,
    isHealthy: true,
    lastChecked: 0,
    consecutiveFailures: 0,
    credits: 0
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
const markApiKeySuccess = (apiKey: string, credits?: number) => {
  const health = apiKeyHealthMap.get(apiKey);
  if (health) {
    health.consecutiveFailures = 0;
    health.isHealthy = true;
    health.lastChecked = Date.now();
    if (credits !== undefined) {
      health.credits = credits;
    }
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
      // Removed verbose logging for security
    }
  }

  const healthyKeys = getHealthyApiKeys();
  if (healthyKeys.length === 0) {
    console.error('No healthy API keys available!');
    return null;
  }

  // Prefer API keys with credits
  const keysWithCredits = healthyKeys.filter(k => k.credits && k.credits > 0);
  if (keysWithCredits.length > 0) {
    // Sort by most credits first
    keysWithCredits.sort((a, b) => (b.credits || 0) - (a.credits || 0));
    // Don't log which API key is being used for security
    return keysWithCredits[0].key;
  }

  // If no keys have cached credit info, use the least recently used
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
      // Don't log which API key is being used for security
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
        // Mark this key as unhealthy due to lack of credits
        markApiKeyFailed(keyHealth.key);
        // Don't log API key details for security
      }
      
      // If this is a billing issue, stop immediately - don't retry with other keys
      if (error.message?.includes('Wiza account has a billing issue')) {
        console.error('Billing account issue detected - stopping all retries');
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
  operation: (url: string, apiKey: string) => Promise<T>,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, T>> {
  const results = new Map<string, T>();
  const healthyKeys = getHealthyApiKeys();
  
  if (healthyKeys.length === 0) {
    throw new Error('No healthy API keys available');
  }

  const urlQueue = [...linkedinUrls];
  const processingPromises: Promise<void>[] = [];
  let completedCount = 0;
  const totalCount = linkedinUrls.length;

  // Process URLs with each healthy API key, allowing multiple workers per key
  for (const keyHealth of healthyKeys) {
    const spawnWorkers = Math.max(1, CONCURRENCY_PER_KEY);

    const processWithKey = async () => {
      while (true) {
        // Respect cooldown for this key if we recently hit a rate limit
        const cooldownUntil = keyCooldownUntil.get(keyHealth.key) || 0;
        const now = Date.now();
        if (cooldownUntil > now) {
          await new Promise(resolve => setTimeout(resolve, Math.min(1000, cooldownUntil - now)));
          continue;
        }

        const url = urlQueue.shift();
        if (!url) break;

        try {
          // Don't log which API key is being used for security
          const result = await operation(url, keyHealth.key);
          results.set(url, result);
          markApiKeySuccess(keyHealth.key);

          // Update progress
          completedCount++;
          if (onProgress) {
            onProgress(completedCount, totalCount);
          }
        } catch (error: any) {
          const message: string = (error?.message || '').toString();
          console.error(`Failed to process ${url}:`, message);

          // Handle explicit rate limiting without marking the key unhealthy
          if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
            keyCooldownUntil.set(keyHealth.key, Date.now() + RATE_LIMIT_COOLDOWN_MS);
            // Re-queue for later attempt
            urlQueue.push(url);
            continue;
          }

          // If the key is out of credits, mark it unhealthy and let other keys pick it up
          if (message.includes('out of credits') || message.includes('402')) {
            markApiKeyFailed(keyHealth.key);
            if (getHealthyApiKeys().length > 0) {
              urlQueue.push(url);
              continue;
            }
          }

          // For other transient errors, re-queue so another key or later retry can handle it
          if (getHealthyApiKeys().length > 0) {
            urlQueue.push(url);
            continue;
          }

          // No healthy keys left: count as completed (failed) and move on without aborting all
          completedCount++;
          if (onProgress) {
            onProgress(completedCount, totalCount);
          }
          // Do not throw here to avoid aborting the whole batch
        }
      }
    };

    for (let i = 0; i < spawnWorkers; i++) {
      processingPromises.push(processWithKey());
    }
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
  school?: string;
  major?: string;
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
      enrichment_level: 'full',  // Full gets both email and phone numbers
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
              enrichment_level: 'full',  // Need 'full' to get both emails and phone numbers
      email_options: {
        accept_work: true,
        accept_personal: true
      }
    };

    console.log('Creating Individual Reveal with payload:', JSON.stringify(payload, null, 2));

    console.log('Making API request to:', `${baseUrl}/api/individual_reveals`);
    // Don't log API key for security
    
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
    const maxWaitTime = 180000; // 3 minutes max (since extraction can take 2+ minutes)
    const startTime = Date.now();
    let pollInterval = 500; // Start fast
    let pollCount = 0;

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
              // Silently proceed - billing_issue with data is common and not a real error
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
          
          // Debug the entire contact object to see all fields
          // Removed detailed logging for privacy
          
          // Extract contact information
          const extractedContact: Contact = {
            id: generateContactId(),
            linkedinUrl: linkedinUrl,
            name: contact.full_name || contact.name || 'Unknown',
            jobTitle: contact.title || contact.job_title || contact.headline || contact.position || '',
            company: contact.company || contact.job_company_name || contact.organization || '',
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
            contact.likely_email
          ];

          // Add individual email fields first
          for (const email of emailFields) {
            if (email && typeof email === 'string' && extractedContact.emails && !extractedContact.emails.includes(email)) {
              extractedContact.emails.push(email);
            }
          }

          // Also handle emails array if it exists (similar to phones array)
          if (contact.emails && Array.isArray(contact.emails)) {
            for (const emailItem of contact.emails) {
              // Check if it's a string or object
              const emailValue = typeof emailItem === 'string' ? emailItem : emailItem?.email;
              if (emailValue && !extractedContact.emails?.includes(emailValue)) {
                extractedContact.emails?.push(emailValue);
              }
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
            contact.phones?.[0]?.number  // phones array contains objects with 'number' property
          ];

          for (const phone of phoneFields) {
            if (phone && typeof phone === 'string' && extractedContact.phones && !extractedContact.phones.includes(phone)) {
              extractedContact.phones.push(phone);
            }
          }

          // Also extract all phones from the phones array if it exists
          if (contact.phones && Array.isArray(contact.phones)) {
            for (const phoneObj of contact.phones) {
              if (phoneObj.number && !extractedContact.phones?.includes(phoneObj.number)) {
                extractedContact.phones?.push(phoneObj.number);
              }
            }
          }

          // Set primary phone
          if (extractedContact.phones && extractedContact.phones.length > 0) {
            extractedContact.phone = extractedContact.phones[0];
          }
          
          // Log extraction summary without revealing personal data
          console.log('✅ Successfully extracted contact');

          return {
            success: true,
            contact: extractedContact
          };
        } else if (statusData.data?.status === 'failed' && statusData.data?.is_complete === true) {
          // Only throw error if the reveal is complete AND failed
          throw new Error('Individual Reveal failed: ' + (statusData.data?.fail_error || statusData.data?.error || 'Unknown error'));
        } else if (statusData.data?.status === 'failed' && statusData.data?.fail_error === 'billing_issue') {
          // If we see billing_issue but it's not complete yet, keep polling silently
          // This is common and not a real error
        }

        // Still processing, wait and try again (dynamic interval)
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        pollCount++;
        if (pollCount === 10 && pollInterval === 500) {
          // After ~5 seconds, back off to 2s
          pollInterval = 2000;
        }
      } catch (pollError) {
        console.error('Error polling reveal status:', pollError);
        // Continue polling despite errors
      }
    }

          throw new Error('Extraction timed out after 3 minutes. The profile might be private or unavailable.');
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
    enrichment_level: 'full', // Full gets both email and phone numbers
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
          // Removed detailed logging for privacy
          
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
          
          // Debug: Log all available fields
          // Removed detailed logging for privacy

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
            jobTitle: status.data.title || status.data.job_title || status.data.headline || status.data.position || '',
            company: status.data.company || status.data.job_company_name || status.data.organization || '',
            location: status.data.location
          };

          console.log('Individual Reveal Contact created successfully');

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

// Search for prospects with tag-based parameters
export const searchProspects = async (
  firstNames?: string[],
  lastNames?: string[],
  jobTitles?: string[],
  locations?: string[],
  size: number = 20
): Promise<ProspectSearchResponse> => {
  const apiKey = getBestApiKey();
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  if (!apiKey) {
    throw new Error('No healthy API keys available for prospect search.');
  }

  // Build filters object
  const filters: ProspectSearchFilters = {};

  if (firstNames && firstNames.length > 0) {
    filters.first_name = firstNames.map(name => name.trim()).filter(name => name.length > 0);
  }

  if (lastNames && lastNames.length > 0) {
    filters.last_name = lastNames.map(name => name.trim()).filter(name => name.length > 0);
  }

  if (jobTitles && jobTitles.length > 0) {
    filters.job_title = jobTitles.map(title => ({
      v: title.trim(),
      s: 'i' as const // include
    })).filter(item => item.v.length > 0);
  }

  if (locations && locations.length > 0) {
    filters.location = locations.map(location => {
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
      
      return {
        v: formattedLocation,
        b: locationType,
        s: 'i' as const
      };
    }).filter(item => item.v.length > 0);
    
    console.log('Locations parsed:', filters.location);
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

// Unlimited prospect search using Prospect List Creation API for large results
export const searchProspectsUnlimited = async (
  firstNames?: string[],
  lastNames?: string[],
  jobTitles?: string[],
  locations?: string[],
  size: number = 100
): Promise<{ total: number; profiles: ProspectProfile[] }> => {
  console.log(`🚀 Unlimited search requested for ${size} results`);
  
  if (size <= 30) {
    // For small requests, use regular search
    console.log('📌 Using regular search API (≤30 results)');
    const results = await searchProspects(firstNames, lastNames, jobTitles, locations, size);
    return {
      total: results.data?.total || 0,
      profiles: results.data?.profiles || []
    };
  }

  // FORCE instant search for better performance - disable fallbacks temporarily
  console.log('🚀 FORCING instant search API with smart batching');
  try {
    const result = await instantProspectSearch(firstNames, lastNames, jobTitles, locations, size);
    console.log('✅ Instant search succeeded, got', result.profiles.length, 'profiles');
    return result;
  } catch (searchError) {
    console.log('❌ Instant search failed with error:', searchError.message || searchError);
    
    // For now, fallback to regular search with the requested size
    console.log('🔄 Fallback: Using regular search API with size', Math.min(size, 30));
    const fallbackResults = await searchProspects(firstNames, lastNames, jobTitles, locations, Math.min(size, 30));
    return {
      total: fallbackResults.data?.total || 0,
      profiles: fallbackResults.data?.profiles || []
    };
  }

  // Last resort: Use the slow Prospect List Creation API (DISABLED for now)
  /*
  try {
    console.log('Creating prospect list for unlimited results...');
    
    // Step 1: Create a prospect list (this bypasses the 30 limit)
    const prospectList = await createProspectList(
      firstNames,
      lastNames,
      jobTitles,
      locations,
      size
    );
    
    const listId = prospectList.data.id;
    console.log(`📋 Created prospect list with ID: ${listId}, max_profiles: ${size}`);
    
    // Step 2: Wait for the list to be processed
    console.log('⏳ Waiting for list processing...');
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max wait (Wiza can take time for large lists)
    const pollInterval = 5000; // 5 seconds
    
    while (attempts < maxAttempts) {
      const status = await checkWizaListStatus(listId.toString());
      console.log(`📊 List status: ${status.data.status}, people: ${status.data.stats?.people || 0}`);
      
      if (status.data.status === 'finished') {
        // Step 3: Get the contacts from the completed list
        try {
          const contacts = await getWizaContacts(listId.toString());
          console.log(`✅ Retrieved ${contacts.data.length} contacts from prospect list`);
          
          // Convert Wiza contacts to ProspectProfile format
          const profiles: ProspectProfile[] = contacts.data.map((contact, index) => {
            // Debug: Log the contact structure for first few contacts
            if (index < 2) {
              console.log(`🔍 Contact ${index + 1} structure:`, {
                full_name: contact.full_name,
                first_name: contact.first_name,
                last_name: contact.last_name,
                linkedin: contact.linkedin,
                linkedin_url: (contact as any).linkedin_url,
                profile_url: (contact as any).profile_url,
                url: (contact as any).url,
                keys: Object.keys(contact)
              });
            }
            
            // Debug LinkedIn URL mapping to understand which field has data
            const linkedinUrl = (contact as any).profile_url || contact.linkedin || (contact as any).linkedin_url || (contact as any).url || '';
            if (index < 5) {
              console.log(`🔗 LinkedIn URL mapping for contact ${index + 1}:`, {
                profile_url: (contact as any).profile_url,
                linkedin: contact.linkedin,
                linkedin_url: (contact as any).linkedin_url,
                url: (contact as any).url,
                final_linkedin_url: linkedinUrl
              });
            }
            
            return {
              full_name: contact.full_name || `${contact.first_name} ${contact.last_name}`.trim(),
              linkedin_url: linkedinUrl,
              industry: contact.company_industry || '',
              job_title: contact.title || '',
              job_company_name: contact.company || '',
              job_company_website: contact.company_domain || '',
              location_name: contact.location || ''
            };
          });
          
          return {
            total: status.data.stats?.people || contacts.data.length,
            profiles: profiles
          };
          
        } catch (contactError: any) {
          if (contactError.message === 'PROFILE_FOUND_NO_CONTACTS') {
            // No contacts found, but we know the total from the list
            console.log('📭 List completed but no contacts to export');
            return {
              total: status.data.stats?.people || 0,
              profiles: []
            };
          }
          throw contactError;
        }
      }
      
      if (status.data.status === 'failed') {
        throw new Error('Prospect list processing failed');
      }
      
      // Still processing, wait and try again
      attempts++;
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    // Timeout reached, but check if we have some completed results
    console.log('⏰ Timeout reached, but checking for partial results...');
    try {
      const finalStatus = await checkWizaListStatus(listId.toString());
      if (finalStatus.data.stats?.people && finalStatus.data.stats.people > 0) {
        console.log(`📊 Found ${finalStatus.data.stats.people} completed prospects, retrieving them...`);
        const contacts = await getWizaContacts(listId.toString());
        
        if (contacts.data && contacts.data.length > 0) {
          const profiles: ProspectProfile[] = contacts.data.map(contact => ({
            full_name: contact.full_name || `${contact.first_name} ${contact.last_name}`.trim(),
            linkedin_url: (contact as any).profile_url || contact.linkedin || (contact as any).linkedin_url || (contact as any).url || '',
            industry: contact.company_industry || '',
            job_title: contact.title || '',
            job_company_name: contact.company || '',
            job_company_website: contact.company_domain || '',
            location_name: contact.location || ''
          }));
          
          console.log(`✅ Retrieved ${profiles.length} partial results before timeout`);
          return {
            total: finalStatus.data.stats?.people || profiles.length,
            profiles: profiles
          };
        }
      }
    } catch (partialError) {
      console.log('❌ Could not retrieve partial results:', partialError);
    }
    
    throw new Error('Prospect list processing timeout (10 minutes) - no partial results available');
    
  } catch (error) {
    console.error('❌ Unlimited search failed, trying multi-API parallel approach:', error);
    
    // Advanced Strategy: Multi-API parallel requests
    try {
      return await parallelMultiApiSearch(firstNames, lastNames, jobTitles, locations, size);
    } catch (parallelError) {
      console.error('❌ Parallel search also failed, falling back to regular search:', parallelError);
      
      // Final Fallback: Use regular search with 30 limit
      const fallbackResults = await searchProspects(firstNames, lastNames, jobTitles, locations, 30);
      return {
        total: fallbackResults.data?.total || 0,
        profiles: fallbackResults.data?.profiles || []
      };
    }
  }
  */
};

// Helper function to split array into chunks for diverse batching
const splitArrayIntoChunks = <T>(array: T[], numChunks: number): T[][] => {
  if (array.length === 0) return [];
  if (numChunks <= 1) return [array];
  
  const chunks: T[][] = [];
  const chunkSize = Math.ceil(array.length / numChunks);
  
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  
  // Fill remaining chunks with empty arrays if needed
  while (chunks.length < numChunks) {
    chunks.push([]);
  }
  
  return chunks;
};

// NEW: Instant Prospect Search with Smart Batching (mimics Wiza's web interface)
const instantProspectSearch = async (
  firstNames?: string[],
  lastNames?: string[],
  jobTitles?: string[],
  locations?: string[],
  targetSize: number = 100
): Promise<{ total: number; profiles: ProspectProfile[] }> => {
  console.log(`⚡ INSTANT prospect search for ${targetSize} results - using fast search API`);
  
  // Strategy: Make multiple calls to the fast /api/prospects/search endpoint
  // Each call gets 30 results instantly, combine them for larger requests
  
  const batchSize = 30;
  const numBatches = Math.ceil(targetSize / batchSize);
  const maxBatches = Math.min(numBatches, 10); // Limit to 10 batches (300 max results)
  
  console.log(`📊 Making ${maxBatches} instant API calls (${batchSize} results each)`);
  
  const allProfiles: ProspectProfile[] = [];
  let totalCount = 0;
  
  // Make multiple parallel calls to get more results with DIVERSE parameters
  const promises: Promise<ProspectSearchResponse>[] = [];
  
  // NEW STRATEGY: Use broad parameters for each batch to get more results
  // Instead of splitting parameters, use variations that are more likely to yield results
  
  for (let i = 0; i < maxBatches; i++) {
    // Strategy 1: Rotate through individual parameters rather than splitting
    let batchFirstNames = firstNames;
    let batchLastNames = lastNames;
    let batchJobTitles = jobTitles;
    let batchLocations = locations;
    
    // For batches after the first few, make parameters broader by using fewer filters
    if (i >= 2) {
      // Remove some filters to broaden the search
      if (i % 2 === 0) {
        batchFirstNames = undefined; // Remove first name filter
      }
      if (i % 3 === 1) {
        batchLastNames = undefined; // Remove last name filter
      }
    }
    
    console.log(`📦 Batch ${i + 1} parameters:`, {
      firstNames: batchFirstNames,
      lastNames: batchLastNames, 
      jobTitles: batchJobTitles,
      locations: batchLocations
    });
    
    const promise = searchProspects(
      batchFirstNames,
      batchLastNames,
      batchJobTitles,
      batchLocations,
      batchSize
    );
    promises.push(promise);
  }
  
  const results = await Promise.allSettled(promises);
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.data?.profiles) {
      const rawProfiles = result.value.data.profiles;
      
      // Debug: Log the first raw profile structure from each batch
      if (rawProfiles.length > 0) {
        console.log(`🔍 INSTANT SEARCH - Batch ${index + 1} RAW profile structure:`, {
          keys: Object.keys(rawProfiles[0]),
          linkedin_url: rawProfiles[0].linkedin_url,
          full_name: rawProfiles[0].full_name,
          school: rawProfiles[0].school,
          major: rawProfiles[0].major,
          sample_profile: rawProfiles[0]
        });
      }
      
      // Map raw profiles to ProspectProfile format
      const mappedProfiles: ProspectProfile[] = rawProfiles.map((rawProfile: any) => {
        // Use similar mapping as the slow search but adapted for instant search response
        const linkedinUrl = rawProfile.linkedin_url || rawProfile.profile_url || rawProfile.linkedin || rawProfile.url || '';
        
        return {
          full_name: rawProfile.full_name || `${rawProfile.first_name || ''} ${rawProfile.last_name || ''}`.trim(),
          linkedin_url: linkedinUrl,
          industry: rawProfile.industry || rawProfile.company_industry || '',
          job_title: rawProfile.job_title || rawProfile.title || '',
          job_title_role: rawProfile.job_title_role || '',
          job_title_sub_role: rawProfile.job_title_sub_role || '',
          job_company_name: rawProfile.job_company_name || rawProfile.company || '',
          job_company_website: rawProfile.job_company_website || rawProfile.company_domain || '',
          location_name: rawProfile.location_name || rawProfile.location || '',
          school: rawProfile.school && Array.isArray(rawProfile.school) ? rawProfile.school.join(', ') : rawProfile.school || '',
          major: rawProfile.major && Array.isArray(rawProfile.major) ? rawProfile.major.join(', ') : rawProfile.major || ''
        };
      });
      
      allProfiles.push(...mappedProfiles);
      totalCount = Math.max(totalCount, result.value.data.total || 0);
      console.log(`✅ Batch ${index + 1}: ${rawProfiles.length} raw profiles -> ${mappedProfiles.length} mapped profiles (${allProfiles.length} total so far)`);
      
    } else {
      console.error(`❌ Batch ${index + 1} failed:`, result.status === 'rejected' ? result.reason : 'Unknown error');
    }
  });
  
  // Remove duplicates based on LinkedIn URL
  const uniqueProfiles = allProfiles.filter((profile, index, self) => {
    const isDuplicate = self.findIndex(p => 
      p.linkedin_url === profile.linkedin_url || 
      (p.full_name === profile.full_name && p.job_company_name === profile.job_company_name)
    ) < index;
    return !isDuplicate;
  });
  
  // Limit to requested size
  const finalProfiles = uniqueProfiles.slice(0, targetSize);
  
  console.log(`🎯 INSTANT search completed: ${finalProfiles.length} unique profiles in ~2-5 seconds!`);
  
  return {
    total: totalCount,
    profiles: finalProfiles
  };
};

// Advanced Strategy: Parallel Multi-API Search to bypass limits
const parallelMultiApiSearch = async (
  firstNames?: string[],
  lastNames?: string[],
  jobTitles?: string[],
  locations?: string[],
  targetSize: number = 100
): Promise<{ total: number; profiles: ProspectProfile[] }> => {
  console.log(`🚀 Parallel Multi-API search for ${targetSize} results`);
  
  // Get all available API keys
  const apiKeys = getAllApiKeys();
  const numKeys = apiKeys.length;
  
  if (numKeys < 2) {
    throw new Error('Need at least 2 API keys for parallel search');
  }
  
  console.log(`🔑 Using ${numKeys} API keys in parallel`);
  
  // Split the target size across available API keys (each can get max 30)
  const maxPerKey = Math.min(30, Math.ceil(targetSize / numKeys));
  const promises: Promise<ProspectSearchResponse>[] = [];
  
  // Create parallel search requests using different API keys
  // Strategy: Use all API keys with full search size to maximize unique results
  for (let i = 0; i < numKeys; i++) {
    const searchSize = Math.min(30, targetSize); // Each gets up to 30 results
    
    // Use the same search parameters but different API keys
    // This gives us more diverse results from Wiza's algorithm
    const promise = searchProspectsWithSpecificKey(
      firstNames,
      lastNames,
      jobTitles,
      locations,
      searchSize,
      apiKeys[i]
    );
    promises.push(promise);
  }
  
  console.log(`📡 Making ${promises.length} parallel API calls with ${targetSize} target size...`);
  
  // Execute all searches in parallel with slight delays to reduce overlap
  const results = await Promise.allSettled(promises);
  
  // Combine results from all successful calls
  let allProfiles: ProspectProfile[] = [];
  let totalFromAll = 0;
  let successfulCalls = 0;
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.data?.profiles) {
      const profiles = result.value.data.profiles;
      allProfiles = [...allProfiles, ...profiles];
      totalFromAll = Math.max(totalFromAll, result.value.data.total || 0);
      successfulCalls++;
      console.log(`✅ API key ${index + 1}: ${profiles.length} profiles`);
    } else {
      console.error(`❌ API key ${index + 1} failed:`, result.status === 'rejected' ? result.reason : 'Unknown error');
    }
  });
  
  // Remove duplicates based on LinkedIn URL and full name
  const uniqueProfiles = allProfiles.filter((profile, index, self) => {
    const isDuplicate = self.findIndex(p => 
      p.linkedin_url === profile.linkedin_url || 
      (p.full_name === profile.full_name && p.job_company_name === profile.job_company_name)
    ) < index;
    return !isDuplicate;
  });
  
  // If we still don't have enough unique results, return what we have
  const finalProfiles = uniqueProfiles.slice(0, targetSize);
  
  console.log(`🎯 Combined results: ${finalProfiles.length} unique profiles from ${successfulCalls} successful calls (requested: ${targetSize})`);
  
  if (finalProfiles.length === 0) {
    throw new Error('All parallel API calls failed');
  }
  
  return {
    total: totalFromAll,
    profiles: finalProfiles
  };
};

// Helper function to search with a specific API key
const searchProspectsWithSpecificKey = async (
  firstNames?: string[],
  lastNames?: string[],
  jobTitles?: string[],
  locations?: string[],
  size: number = 20,
  apiKey: string
): Promise<ProspectSearchResponse> => {
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  // Build filters object (same logic as regular search)
  const filters: ProspectSearchFilters = {};

  if (firstNames && firstNames.length > 0) {
    filters.first_name = firstNames.map(name => name.trim()).filter(name => name.length > 0);
  }

  if (lastNames && lastNames.length > 0) {
    filters.last_name = lastNames.map(name => name.trim()).filter(name => name.length > 0);
  }

  if (jobTitles && jobTitles.length > 0) {
    filters.job_title = jobTitles.map(title => ({
      v: title.trim(),
      s: 'i' as const
    })).filter(item => item.v.length > 0);
  }

  if (locations && locations.length > 0) {
    filters.location = locations.map(location => {
      const locationValue = location.trim();
      const parts = locationValue.split(',').map(p => p.trim());
      
      let locationType: 'city' | 'state' | 'country';
      let formattedLocation: string;
      
      if (parts.length >= 3) {
        locationType = 'city';
        formattedLocation = locationValue;
      } else if (parts.length === 2) {
        locationType = 'state';
        formattedLocation = locationValue;
      } else {
        locationType = 'country';
        formattedLocation = locationValue;
      }
      
      return {
        v: formattedLocation,
        b: locationType,
        s: 'i' as const
      };
    }).filter(item => item.v.length > 0);
  }

  const payload = {
    size: Math.min(size, 30), // Ensure we don't exceed 30
    filters
  };

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
    throw new Error(`API call failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data;
};

// Create prospect list for contact extraction
export const createProspectList = async (
  firstNames?: string[],
  lastNames?: string[],
  jobTitles?: string[],
  locations?: string[],
  maxProfiles: number = 20
): Promise<ProspectListResponse> => {
  const apiKey = getBestApiKey();
  const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

  if (!apiKey) {
    throw new Error('No healthy API keys available for prospect list creation.');
  }

  // Build filters object (same as search)
  const filters: ProspectSearchFilters = {};

  if (firstNames && firstNames.length > 0) {
    filters.first_name = firstNames.map(name => name.trim()).filter(name => name.length > 0);
  }

  if (lastNames && lastNames.length > 0) {
    filters.last_name = lastNames.map(name => name.trim()).filter(name => name.length > 0);
  }

  if (jobTitles && jobTitles.length > 0) {
    filters.job_title = jobTitles.map(title => ({
      v: title.trim(),
      s: 'i' as const
    })).filter(item => item.v.length > 0);
  }

  if (locations && locations.length > 0) {
    filters.location = locations.map(location => {
      const locationValue = location.trim();
      const parts = locationValue.split(',').map(p => p.trim());
      
      let locationType: 'city' | 'state' | 'country';
      
      if (parts.length >= 3) {
        locationType = 'city';
      } else if (parts.length === 2) {
        locationType = 'state';
      } else {
        locationType = 'country';
      }
      
      return {
        v: locationValue,
        b: locationType,
        s: 'i' as const
      };
    }).filter(item => item.v.length > 0);
  }

  const searchTerms = [
    ...(firstNames || []),
    ...(lastNames || []),
    ...(jobTitles || []),
    ...(locations || [])
  ].slice(0, 3).join(', ');
  
  const listName = `Prospect Search - ${searchTerms} - ${Date.now()}`;

  const payload = {
    list: {
      name: listName,
      max_profiles: maxProfiles,
      enrichment_level: 'full',
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
export const extractContactsInParallel = async (
  linkedinUrls: string[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, ExtractionResult>> => {
  console.log(`Starting parallel extraction for ${linkedinUrls.length} LinkedIn URLs`);
  // Don't log API key details for security
  
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
    // Use the parallel processing system with progress tracking
    const results = await executeInParallel(validUrls, async (linkedinUrl, apiKey) => {
      const baseUrl = process.env.WIZA_BASE_URL || 'https://wiza.co';

      // Create Individual Reveal for this URL
      const payload = {
        individual_reveal: {
          profile_url: linkedinUrl
        },
        enrichment_level: 'full',  // Full gets both email and phone numbers
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
      const startTime = Date.now();
      let pollInterval = 500; // Start fast for early completions
      let pollCount = 0;

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
            // The contact data is directly in statusData.data, not statusData.data.contact
            const contact = statusData.data;
            
            // Log the response for debugging
            // Removed detailed logging for privacy
            
            if (!contact || !contact.name) {
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
              jobTitle: contact.title || contact.job_title || contact.headline || contact.position || '',
              company: contact.company || contact.job_company_name || contact.organization || '',
              location: contact.location || '',
              email: '',
              emails: [],
              phone: '',
              phones: [],
              extractedAt: new Date().toISOString()
            };

            // Extract emails - handle both individual fields and arrays
            const emailFields = [
              contact.email,
              contact.work_email,
              contact.personal_email,
              contact.likely_email
            ];
            
            // Add individual email fields first
            for (const email of emailFields) {
              if (email && typeof email === 'string' && extractedContact.emails && !extractedContact.emails.includes(email)) {
                extractedContact.emails.push(email);
              }
            }
            
            // Also handle emails array if it exists
            if (contact.emails && Array.isArray(contact.emails)) {
              for (const emailItem of contact.emails) {
                const emailValue = typeof emailItem === 'string' ? emailItem : emailItem?.email;
                if (emailValue && !extractedContact.emails?.includes(emailValue)) {
                  extractedContact.emails?.push(emailValue);
                }
              }
            }
            
            if (extractedContact.emails && extractedContact.emails.length > 0) {
              extractedContact.email = extractedContact.emails[0];
            }

            // Extract phones - handle both individual fields and arrays
            const phoneFields = [
              contact.phone_number,
              contact.phone,
              contact.mobile_phone,
              contact.work_phone
            ];
            
            // Add individual phone fields first
            for (const phone of phoneFields) {
              if (phone && typeof phone === 'string' && extractedContact.phones && !extractedContact.phones.includes(phone)) {
                extractedContact.phones.push(phone);
              }
            }
            
            // Also handle phones array if it exists
            if (contact.phones && Array.isArray(contact.phones)) {
              for (const phoneItem of contact.phones) {
                const phoneValue = typeof phoneItem === 'string' ? phoneItem : phoneItem?.number;
                if (phoneValue && !extractedContact.phones?.includes(phoneValue)) {
                  extractedContact.phones?.push(phoneValue);
                }
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
        pollCount++;
        if (pollCount === 10 && pollInterval === 500) {
          pollInterval = 2000; // Back off after ~5 seconds
        }
      }

      return {
        success: false,
        error: 'Extraction timed out'
      };
    }, onProgress); // Pass onProgress to executeInParallel

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