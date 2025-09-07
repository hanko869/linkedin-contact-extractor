'use client';

import { useState, KeyboardEvent, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { generateCSV, downloadCSV } from '@/utils/csv';
import AutocompleteInput from './AutocompleteInput';
import { locationSuggestions, jobTitleSuggestions, commonFirstNames, commonLastNames } from '@/utils/suggestions';

interface ProspectProfile {
  full_name: string;
  linkedin_url: string;
  industry?: string;
  job_title?: string;
  job_company_name?: string;
  job_company_website?: string;
  location_name?: string;
  school?: string;
  major?: string;
}

// Helper function to get initials from full name
const getInitials = (name: string): string => {
  if (!name || name.trim() === '') return '?';
  
  const initials = name
    .trim()
    .split(' ')
    .filter(part => part.length > 0)
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  
  return initials || '?';
};

// Helper function to generate consistent color from name
const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
    'bg-indigo-500', 'bg-yellow-500', 'bg-red-500', 'bg-gray-500'
  ];
  const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export default function ProspectSearchClient() {
  const router = useRouter();
  
  // Tag-based state management
  const [firstNames, setFirstNames] = useState<string[]>([]);
  const [lastNames, setLastNames] = useState<string[]>([]);
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  
  // Input state for adding new tags
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [jobTitleInput, setJobTitleInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ProspectProfile[]>([]);
  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set());
  const [searchError, setSearchError] = useState('');
  const [isExtractingProspects, setIsExtractingProspects] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  
  // Infinite scroll state
  const [currentPage, setCurrentPage] = useState(1);
  const [allResults, setAllResults] = useState<ProspectProfile[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const resultsPerPage = 100;
  const maxPages = 10; // Cap at 10 pages (1000 total results)

  // Infinite scroll ref
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Infinite scroll effect
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMoreResults();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasMore, loadingMore]);

  // Tag management functions
  const addFirstName = (name: string) => {
    if (name.trim() && !firstNames.includes(name.trim())) {
      setFirstNames([...firstNames, name.trim()]);
      setFirstNameInput('');
    }
  };

  const removeFirstName = (name: string) => {
    setFirstNames(firstNames.filter(n => n !== name));
  };

  const addLastName = (name: string) => {
    if (name.trim() && !lastNames.includes(name.trim())) {
      setLastNames([...lastNames, name.trim()]);
      setLastNameInput('');
    }
  };

  const removeLastName = (name: string) => {
    setLastNames(lastNames.filter(n => n !== name));
  };

  const addJobTitle = (title: string) => {
    if (title.trim() && !jobTitles.includes(title.trim())) {
      setJobTitles([...jobTitles, title.trim()]);
      setJobTitleInput('');
    }
  };

  const removeJobTitle = (title: string) => {
    setJobTitles(jobTitles.filter(t => t !== title));
  };

  const addLocation = (loc: string) => {
    if (loc.trim() && !locations.includes(loc.trim())) {
      setLocations([...locations, loc.trim()]);
      setLocationInput('');
    }
  };

  const removeLocation = (loc: string) => {
    setLocations(locations.filter(l => l !== loc));
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>, addFunction: (value: string) => void, inputValue: string) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addFunction(inputValue);
    }
  };

  const handleSearch = async () => {
    if (firstNames.length === 0 && lastNames.length === 0 && jobTitles.length === 0 && locations.length === 0) {
      setSearchError('Please enter at least one search parameter');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);
    setAllResults([]);
    setSelectedProspects(new Set());
    setCurrentPage(1);
    setHasMore(true);

    try {
      const response = await fetch('/api/prospects/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstNames,
          lastNames,
          jobTitles,
          locations,
          size: resultsPerPage
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Search failed');
      }

      const profiles = data.profiles || [];
      console.log('🎯 CLIENT: Received', profiles.length, 'profiles, total:', data.total);
      console.log('🔍 CLIENT: First 3 profiles data:', profiles.slice(0, 3));
      console.log('🔗 CLIENT: LinkedIn URLs in first 3:', profiles.slice(0, 3).map(p => p.linkedin_url));
      setSearchResults(profiles);
      setAllResults(profiles);
      setTotalResults(data.total || 0);
      
      if (profiles.length === 0) {
        setSearchError('No prospects found matching your criteria');
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Failed to search prospects');
    } finally {
      setIsSearching(false);
    }
  };

  const loadMoreResults = useCallback(async () => {
    if (loadingMore || !hasMore || currentPage >= maxPages) return;

    setLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      const response = await fetch('/api/prospects/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstNames,
          lastNames,
          jobTitles,
          locations,
          size: resultsPerPage,
          page: nextPage
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load more results');
      }

      const newProfiles = data.profiles || [];
      
      if (newProfiles.length === 0) {
        setHasMore(false);
        return;
      }

      // Filter out duplicates based on LinkedIn URL
      const existingUrls = new Set(allResults.map(p => p.linkedin_url));
      const uniqueNewProfiles = newProfiles.filter((p: ProspectProfile) => !existingUrls.has(p.linkedin_url));
      
      const updatedAllResults = [...allResults, ...uniqueNewProfiles];
      setAllResults(updatedAllResults);
      setSearchResults(updatedAllResults);
      setCurrentPage(nextPage);

      // Check if we should stop loading more
      if (uniqueNewProfiles.length === 0 || nextPage >= maxPages) {
        setHasMore(false);
      }
      
    } catch (error) {
      console.error('Load more results error:', error);
      setSearchError(error instanceof Error ? error.message : 'Failed to load more results');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, currentPage, maxPages, firstNames, lastNames, jobTitles, locations, resultsPerPage, allResults]);

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

  const exportResults = () => {
    if (searchResults.length === 0) {
      setSearchError('No results to export');
      return;
    }

    const csvData = searchResults.map(profile => ({
      name: profile.full_name,
      linkedin_url: profile.linkedin_url && profile.linkedin_url.trim() 
        ? (profile.linkedin_url.startsWith('http') ? profile.linkedin_url : `https://${profile.linkedin_url}`)
        : '',
      job_title: profile.job_title || '',
      company: profile.job_company_name || '',
      location: profile.location_name || '',
      industry: profile.industry || '',
      school: profile.school || '',
      major: profile.major || ''
    }));

    const csv = generateCSV(csvData, {
      name: 'Name',
      linkedin_url: 'LinkedIn URL',
      job_title: 'Job Title',
      company: 'Company',
      location: 'Location',
      industry: 'Industry',
      school: 'School',
      major: 'Major'
    });

    downloadCSV(csv, `prospect-search-${Date.now()}.csv`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Search Form */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Search Criteria</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* First Names */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Names (Press Enter or comma to add)
            </label>
            <div className="mb-2">
              <AutocompleteInput
                placeholder="e.g., John, Jane, Mike"
                value={firstNameInput}
                onChange={setFirstNameInput}
                onKeyPress={(e) => handleKeyPress(e, addFirstName, firstNameInput)}
                suggestions={commonFirstNames}
                maxSuggestions={8}
              />
            </div>
            <div className="flex flex-wrap gap-1 min-h-[2rem]">
              {firstNames.map((name) => (
                <span key={name} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {name}
                  <button
                    type="button"
                    onClick={() => removeFirstName(name)}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                    disabled={isSearching || isExtractingProspects}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          
          {/* Last Names */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Names (Press Enter or comma to add)
            </label>
            <div className="mb-2">
              <AutocompleteInput
                placeholder="e.g., Smith, Johnson, Wilson"
                value={lastNameInput}
                onChange={setLastNameInput}
                onKeyPress={(e) => handleKeyPress(e, addLastName, lastNameInput)}
                suggestions={commonLastNames}
                maxSuggestions={8}
              />
            </div>
            <div className="flex flex-wrap gap-1 min-h-[2rem]">
              {lastNames.map((name) => (
                <span key={name} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {name}
                  <button
                    type="button"
                    onClick={() => removeLastName(name)}
                    className="ml-1 text-green-600 hover:text-green-800"
                    disabled={isSearching || isExtractingProspects}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          
          {/* Job Titles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Titles (Press Enter or comma to add)
            </label>
            <div className="mb-2">
              <AutocompleteInput
                placeholder="e.g., CEO, Sales Manager, Developer"
                value={jobTitleInput}
                onChange={setJobTitleInput}
                onKeyPress={(e) => handleKeyPress(e, addJobTitle, jobTitleInput)}
                suggestions={jobTitleSuggestions}
                maxSuggestions={8}
              />
            </div>
            <div className="flex flex-wrap gap-1 min-h-[2rem]">
              {jobTitles.map((title) => (
                <span key={title} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {title}
                  <button
                    type="button"
                    onClick={() => removeJobTitle(title)}
                    className="ml-1 text-purple-600 hover:text-purple-800"
                    disabled={isSearching || isExtractingProspects}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          
          {/* Locations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Locations (Press Enter or comma to add)
            </label>
            <div className="mb-2">
              <AutocompleteInput
                placeholder="e.g., New York, NY, USA"
                value={locationInput}
                onChange={setLocationInput}
                onKeyPress={(e) => handleKeyPress(e, addLocation, locationInput)}
                suggestions={locationSuggestions}
                maxSuggestions={8}
              />
            </div>
            <div className="flex flex-wrap gap-1 min-h-[2rem]">
              {locations.map((location) => (
                <span key={location} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  {location}
                  <button
                    type="button"
                    onClick={() => removeLocation(location)}
                    className="ml-1 text-orange-600 hover:text-orange-800"
                    disabled={isSearching || isExtractingProspects}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={handleSearch}
            disabled={isSearching || isExtractingProspects || (firstNames.length === 0 && lastNames.length === 0 && jobTitles.length === 0 && locations.length === 0)}
            className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${
              isSearching || isExtractingProspects || (firstNames.length === 0 && lastNames.length === 0 && jobTitles.length === 0 && locations.length === 0)
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
              Found {totalResults.toLocaleString()} prospects (showing {searchResults.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={exportResults}
                className="text-sm px-3 py-1 text-green-600 hover:bg-green-50 rounded-md transition-colors font-medium"
              >
                Export Results
              </button>
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
                    Profile
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
                    <td className="px-4 py-3">
                      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-white text-sm font-medium ${getAvatarColor(prospect.full_name)}`}>
                        {getInitials(prospect.full_name)}
                      </div>
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
          
          {/* Infinite Scroll Trigger */}
          <div className="mt-4 p-4 bg-gray-50 border-t">
            <div className="text-sm text-gray-600 text-center">
              Showing {searchResults.length} of {totalResults.toLocaleString()} prospects
            </div>
            
            {/* Infinite scroll loading trigger */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex items-center justify-center mt-4">
                {loadingMore ? (
                  <div className="flex items-center text-gray-600">
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading more results...
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    Scroll down for more results
                  </div>
                )}
              </div>
            )}
            
            {!hasMore && searchResults.length > 0 && (
              <div className="text-center text-gray-500 text-sm mt-4">
                {currentPage >= maxPages 
                  ? `Maximum ${maxPages * resultsPerPage} results reached`
                  : 'No more results available'
                }
              </div>
            )}
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

