'use client';

import React, { useState, useEffect } from 'react';
import { searchProspects, extractContactWithWiza, createProspectList } from '@/utils/wiza';
import { Contact } from '@/types/contact';
import { saveContact } from '@/utils/storage';

interface ProspectProfile {
  full_name: string;
  linkedin_url: string;
  industry?: string;
  job_title?: string;
  job_company_name?: string;
  location_name?: string;
}

interface SearchResult {
  total: number;
  profiles: ProspectProfile[];
}

// Rate limiting state
interface RateLimit {
  lastRequest: number;
  requestCount: number;
}

const ProspectSearch: React.FC = () => {
  const [searchForm, setSearchForm] = useState({
    firstName: '',
    lastName: '',
    jobTitle: '',
    location: ''
  });
  
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [extractingProfile, setExtractingProfile] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; message: string } | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimit>({ lastRequest: 0, requestCount: 0 });

  const RESULTS_PER_PAGE = 20;
  const RATE_LIMIT_WINDOW = 60000; // 1 minute
  const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute
  const REQUEST_DELAY = 2000; // 2 seconds between requests

  // Rate limiting check
  const checkRateLimit = (): boolean => {
    const now = Date.now();
    const timeSinceLastRequest = now - rateLimit.lastRequest;
    
    // Reset counter if window has passed
    if (timeSinceLastRequest > RATE_LIMIT_WINDOW) {
      setRateLimit({ lastRequest: now, requestCount: 1 });
      return true;
    }
    
    // Check if we've hit the limit
    if (rateLimit.requestCount >= MAX_REQUESTS_PER_WINDOW) {
      const waitTime = Math.ceil((RATE_LIMIT_WINDOW - timeSinceLastRequest) / 1000);
      setFeedback({
        type: 'warning',
        message: `Rate limit reached. Please wait ${waitTime} seconds before searching again.`
      });
      return false;
    }
    
    // Check minimum delay between requests
    if (timeSinceLastRequest < REQUEST_DELAY) {
      setFeedback({
        type: 'info',
        message: 'Please wait a moment between searches to avoid rate limiting.'
      });
      return false;
    }
    
    setRateLimit(prev => ({
      lastRequest: now,
      requestCount: prev.requestCount + 1
    }));
    
    return true;
  };

  const handleSearch = async () => {
    if (!checkRateLimit()) return;
    
    // Validate that at least one field is filled
    if (!searchForm.firstName && !searchForm.lastName && !searchForm.jobTitle && !searchForm.location) {
      setFeedback({
        type: 'error',
        message: 'Please fill in at least one search field.'
      });
      return;
    }

    setIsSearching(true);
    setFeedback(null);
    setCurrentPage(1);

    try {
      console.log('Starting prospect search with:', searchForm);
      
      const response = await searchProspects(
        searchForm.firstName || undefined,
        searchForm.lastName || undefined,
        searchForm.jobTitle || undefined,
        searchForm.location || undefined,
        RESULTS_PER_PAGE
      );

      if (response.data && response.data.profiles) {
        setSearchResults({
          total: response.data.total,
          profiles: response.data.profiles
        });

        setFeedback({
          type: 'success',
          message: `Found ${response.data.total} prospect${response.data.total !== 1 ? 's' : ''} matching your criteria.`
        });
      } else {
        setSearchResults({ total: 0, profiles: [] });
        setFeedback({
          type: 'info',
          message: 'No prospects found matching your search criteria. Try adjusting your search terms.'
        });
      }

    } catch (error) {
      console.error('Prospect search error:', error);
      setFeedback({
        type: 'error',
        message: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleExtractContact = async (profile: ProspectProfile) => {
    const profileKey = `${profile.full_name}-${profile.linkedin_url}`;
    setExtractingProfile(profileKey);
    setFeedback(null);

    try {
      console.log('Extracting contact for:', profile.full_name);
      
      // Add timeout wrapper for extraction
      const extractionPromise = extractContactWithWiza(`https://www.linkedin.com${profile.linkedin_url}`);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Extraction timeout')), 180000) // 3 minutes timeout (increased)
      );

      const result = await Promise.race([extractionPromise, timeoutPromise]) as any;

      if (result.success && result.contact) {
        // Save the contact
        saveContact(result.contact);
        
        setFeedback({
          type: 'success',
          message: `✅ Contact extracted successfully for ${profile.full_name}! Contact saved to your list.`
        });
      } else {
        setFeedback({
          type: 'warning',
          message: `⚠️ Could not extract contact information for ${profile.full_name}. ${result.error || 'Contact information may not be publicly available.'}`
        });
      }

    } catch (error) {
      console.error('Contact extraction error:', error);
      setFeedback({
        type: 'error',
        message: `❌ Failed to extract contact for ${profile.full_name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setExtractingProfile(null);
    }
  };

  const formatLinkedInUrl = (url: string): string => {
    if (url.startsWith('https://')) return url;
    if (url.startsWith('linkedin.com')) return `https://www.${url}`;
    return `https://www.linkedin.com${url}`;
  };

  const totalPages = searchResults ? Math.ceil(searchResults.total / RESULTS_PER_PAGE) : 0;
  const currentProfiles = searchResults?.profiles || [];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">🔍 LinkedIn Prospect Search</h2>
      
      {/* Search Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., John"
            value={searchForm.firstName}
            onChange={(e) => setSearchForm(prev => ({ ...prev, firstName: e.target.value }))}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Smith"
            value={searchForm.lastName}
            onChange={(e) => setSearchForm(prev => ({ ...prev, lastName: e.target.value }))}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Software Engineer, CEO"
            value={searchForm.jobTitle}
            onChange={(e) => setSearchForm(prev => ({ ...prev, jobTitle: e.target.value }))}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., San Francisco, CA, USA or California, USA or USA"
            value={searchForm.location}
            onChange={(e) => setSearchForm(prev => ({ ...prev, location: e.target.value }))}
          />
          <p className="text-xs text-gray-500 mt-1">
            Use format: "City, State, Country" or "State, Country" or just "Country"
          </p>
        </div>
      </div>

      {/* Search Button */}
      <div className="mb-6">
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-md transition-colors duration-200"
        >
          {isSearching ? 'Searching...' : '🔍 Search Prospects'}
        </button>
        
        <p className="text-sm text-gray-600 mt-2">
          Rate limit: {MAX_REQUESTS_PER_WINDOW - rateLimit.requestCount} searches remaining this minute
        </p>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`p-4 rounded-md mb-6 ${
          feedback.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          feedback.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          feedback.type === 'warning' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* Search Results */}
      {searchResults && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Search Results ({searchResults.total} found)
            </h3>
            {totalPages > 1 && (
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
            )}
          </div>

          {/* Results List */}
          <div className="space-y-4">
            {currentProfiles.map((profile, index) => {
              const profileKey = `${profile.full_name}-${profile.linkedin_url}`;
              const isExtracting = extractingProfile === profileKey;
              
              return (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 text-lg">{profile.full_name}</h4>
                      {profile.job_title && (
                        <p className="text-gray-600 mt-1">💼 {profile.job_title}</p>
                      )}
                      {profile.job_company_name && (
                        <p className="text-gray-600 mt-1">🏢 {profile.job_company_name}</p>
                      )}
                      {profile.location_name && (
                        <p className="text-gray-600 mt-1">📍 {profile.location_name}</p>
                      )}
                      {profile.industry && (
                        <p className="text-gray-600 mt-1">🏭 {profile.industry}</p>
                      )}
                      <a 
                        href={formatLinkedInUrl(profile.linkedin_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
                      >
                        🔗 View LinkedIn Profile
                      </a>
                    </div>
                    
                    <button
                      onClick={() => handleExtractContact(profile)}
                      disabled={isExtracting || extractingProfile !== null}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md ml-4 transition-colors duration-200"
                    >
                      {isExtracting ? 'Extracting...' : '📧 Extract Contact'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center mt-6 space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md disabled:opacity-50 hover:bg-gray-300"
              >
                ← Previous
              </button>
              
              <span className="px-4 py-2 text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md disabled:opacity-50 hover:bg-gray-300"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-800 mb-2">💡 Search Tips:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Fill in at least one search field to find prospects</li>
          <li>• Use specific job titles for better results (e.g., "Software Engineer" vs "Engineer")</li>
          <li>• Location format: "City, State, Country" (e.g., "San Francisco, CA, USA") or "State, Country" (e.g., "California, USA") or just "Country" (e.g., "USA")</li>
          <li>• Rate limited to {MAX_REQUESTS_PER_WINDOW} searches per minute to ensure system stability</li>
          <li>• Contact extraction may take up to 3 minutes per profile</li>
        </ul>
      </div>
    </div>
  );
};

export default ProspectSearch; 