'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProspectProfile {
  full_name: string;
  linkedin_url: string;
  industry?: string;
  job_title?: string;
  job_company_name?: string;
  job_company_website?: string;
  location_name?: string;
}

export default function ProspectSearchClient() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [location, setLocation] = useState('');
  const [searchSize, setSearchSize] = useState(10);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ProspectProfile[]>([]);
  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set());
  const [searchError, setSearchError] = useState('');
  const [isExtractingProspects, setIsExtractingProspects] = useState(false);

  const handleSearch = async () => {
    if (!firstName && !lastName && !jobTitle && !location) {
      setSearchError('Please enter at least one search parameter');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);
    setSelectedProspects(new Set());

    try {
      const response = await fetch('/api/prospects/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          jobTitle,
          location,
          size: searchSize
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Search failed');
      }

      setSearchResults(data.profiles || []);
      
      if (data.profiles.length === 0) {
        setSearchError('No prospects found matching your criteria');
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Failed to search prospects');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleProspectSelection = (linkedinUrl: string) => {
    const newSelected = new Set(selectedProspects);
    if (newSelected.has(linkedinUrl)) {
      newSelected.delete(linkedinUrl);
    } else {
      newSelected.add(linkedinUrl);
    }
    setSelectedProspects(newSelected);
  };

  const selectAll = () => {
    const allUrls = searchResults.map(p => p.linkedin_url);
    setSelectedProspects(new Set(allUrls));
  };

  const deselectAll = () => {
    setSelectedProspects(new Set());
  };

  const extractSelectedProspects = async () => {
    if (selectedProspects.size === 0) {
      setSearchError('Please select at least one prospect');
      return;
    }

    // Store selected prospects in localStorage for the main page to process
    const selectedUrls = Array.from(selectedProspects).map(url => {
      if (!url.startsWith('http')) {
        return `https://${url}`;
      }
      return url;
    });

    localStorage.setItem('pendingProspectExtraction', JSON.stringify(selectedUrls));
    
    // Navigate back to the main page
    router.push('/');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Search Form */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Search Criteria</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g., John"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSearching || isExtractingProspects}
            />
          </div>
          
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g., Smith"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSearching || isExtractingProspects}
            />
          </div>
          
          <div>
            <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-1">
              Job Title
            </label>
            <input
              type="text"
              id="jobTitle"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g., CEO, Sales Manager"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSearching || isExtractingProspects}
            />
          </div>
          
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., New York, NY, USA"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSearching || isExtractingProspects}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="searchSize" className="text-sm font-medium text-gray-700">
              Results:
            </label>
            <select
              id="searchSize"
              value={searchSize}
              onChange={(e) => setSearchSize(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSearching || isExtractingProspects}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
            </select>
          </div>
          
          <button
            onClick={handleSearch}
            disabled={isSearching || isExtractingProspects || (!firstName && !lastName && !jobTitle && !location)}
            className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${
              isSearching || isExtractingProspects || (!firstName && !lastName && !jobTitle && !location)
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSearching ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Searching...
              </span>
            ) : (
              'Search Prospects'
            )}
          </button>
        </div>
        
        {/* Error Message */}
        {searchError && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {searchError}
          </div>
        )}
      </div>
      
      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Found {searchResults.length} prospects
            </h3>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-sm px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="text-sm px-3 py-1 text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
              >
                Deselect All
              </button>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedProspects.size === searchResults.length}
                      onChange={() => selectedProspects.size === searchResults.length ? deselectAll() : selectAll()}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    LinkedIn
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {searchResults.map((prospect, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedProspects.has(prospect.linkedin_url)}
                        onChange={() => toggleProspectSelection(prospect.linkedin_url)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {prospect.full_name}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {prospect.linkedin_url ? (
                        <a
                          href={prospect.linkedin_url.startsWith('http') ? prospect.linkedin_url : `https://${prospect.linkedin_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {prospect.job_title || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {prospect.job_company_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {prospect.location_name || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {selectedProspects.size > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {selectedProspects.size} prospect{selectedProspects.size !== 1 ? 's' : ''} selected
              </p>
              <button
                onClick={extractSelectedProspects}
                disabled={isExtractingProspects}
                className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${
                  isExtractingProspects
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isExtractingProspects ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  `Extract ${selectedProspects.size} Contact${selectedProspects.size !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

