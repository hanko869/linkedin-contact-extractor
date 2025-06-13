'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Contact } from '@/types/contact';
import { isValidLinkedInUrl, extractContactFromLinkedIn, checkAPIConfiguration } from '@/utils/extraction';
import { saveContact, getStoredContacts, clearStoredContacts } from '@/utils/storage';
import { generateCSV, downloadCSV } from '@/utils/csv';

const ContactExtractor: React.FC = () => {
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; message: string } | null>(null);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load contacts from localStorage and check API configuration on component mount
  useEffect(() => {
    setContacts(getStoredContacts());
    
    // Check API configuration for Wiza
    checkAPIConfiguration().then(configured => {
      setApiConfigured(configured);
    });
  }, []);

  const showFeedback = (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 7000);
  };

  const handleExtractContact = async () => {
    if (!linkedinUrl.trim()) {
      showFeedback('error', 'Please enter a LinkedIn profile URL');
      return;
    }

    if (!isValidLinkedInUrl(linkedinUrl)) {
      showFeedback('error', 'Please enter a valid LinkedIn profile URL (e.g., https://linkedin.com/in/username)');
      return;
    }

    // Check API configuration before proceeding
    if (apiConfigured === false) {
      showFeedback('error', 'Wiza API is not configured. Please check your API key.');
      return;
    }

    setIsExtracting(true);
    showFeedback('info', 'Extracting contact information...');

    try {
      const result = await extractContactFromLinkedIn(linkedinUrl);
      
      if (result.success && result.contact) {
        saveContact(result.contact);
        setContacts(getStoredContacts());
        setLinkedinUrl('');
        
        const emailCount = result.contact.emails?.length || (result.contact.email ? 1 : 0);
        const phoneCount = result.contact.phones?.length || (result.contact.phone ? 1 : 0);
        
        const contactInfo = [];
        if (emailCount > 0) {
          contactInfo.push(`${emailCount} email${emailCount > 1 ? 's' : ''}`);
        }
        if (phoneCount > 0) {
          contactInfo.push(`${phoneCount} phone${phoneCount > 1 ? 's' : ''}`);
        }
        
        const detailInfo = contactInfo.length > 0 ? 
          `Found ${contactInfo.join(' and ')}!` : 
          'Contact saved (limited info available)';
        
        showFeedback('success', `✅ Contact extracted successfully! ${detailInfo}`);
      } else {
        showFeedback('error', result.error || 'Failed to extract contact information');
      }
    } catch (error) {
      console.error('Contact extraction error:', error);
      showFeedback('error', 'An unexpected error occurred during extraction');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's a text file
    if (!file.name.endsWith('.txt')) {
      showFeedback('error', 'Please upload a .txt file containing LinkedIn URLs (one per line)');
      return;
    }

    // Check API configuration before proceeding
    if (apiConfigured === false) {
      showFeedback('error', 'Wiza API is not configured. Please check your API key.');
      return;
    }

    try {
      const text = await file.text();
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      // Extract valid LinkedIn URLs
      const validUrls: string[] = [];
      const invalidLines: string[] = [];
      
      lines.forEach(line => {
        if (isValidLinkedInUrl(line)) {
          validUrls.push(line);
        } else if (line.includes('linkedin.com')) {
          // Try to fix common URL issues
          let fixedUrl = line;
          if (!line.startsWith('http')) {
            fixedUrl = 'https://' + line;
          }
          if (isValidLinkedInUrl(fixedUrl)) {
            validUrls.push(fixedUrl);
          } else {
            invalidLines.push(line);
          }
        } else {
          invalidLines.push(line);
        }
      });

      if (validUrls.length === 0) {
        showFeedback('error', 'No valid LinkedIn URLs found in the file. Please ensure each line contains a valid LinkedIn profile URL.');
        return;
      }

      if (validUrls.length > 100) {
        showFeedback('error', `File contains ${validUrls.length} URLs. Maximum allowed is 100 URLs per file to manage costs.`);
        return;
      }

      if (invalidLines.length > 0) {
        showFeedback('warning', `Found ${validUrls.length} valid URLs. Skipped ${invalidLines.length} invalid lines.`);
      } else {
        showFeedback('info', `Processing ${validUrls.length} LinkedIn URLs...`);
      }

      setIsExtracting(true);
      setBulkProgress({ current: 0, total: validUrls.length });

      // Process URLs in batches using individual reveals
      const extractedContacts: Contact[] = [];
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < validUrls.length; i++) {
        setBulkProgress({ current: i + 1, total: validUrls.length });
        
        try {
          const result = await extractContactFromLinkedIn(validUrls[i]);
          if (result.success && result.contact) {
            extractedContacts.push(result.contact);
            saveContact(result.contact);
            successCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          console.error(`Failed to extract contact from ${validUrls[i]}:`, error);
          failedCount++;
        }
        
        // Add a small delay between requests to avoid rate limiting
        if (i < validUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
      }

      setContacts(getStoredContacts());
      
      let message = `✅ Successfully extracted ${successCount} contacts`;
      if (failedCount > 0) {
        message += ` (${failedCount} failed or had no contact info)`;
      }
      
      showFeedback('success', message);

    } catch (error) {
      console.error('File upload error:', error);
      showFeedback('error', 'Failed to read the file. Please ensure it\'s a valid text file.');
    } finally {
      setIsExtracting(false);
      setBulkProgress(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadCSV = () => {
    if (contacts.length === 0) {
      showFeedback('error', 'No contacts to download');
      return;
    }

    try {
      const csvContent = generateCSV(contacts);
      const timestamp = new Date().toISOString().split('T')[0];
      downloadCSV(csvContent, `linkedin_contacts_${timestamp}.csv`);
      
      // Clear all data after successful download
      clearStoredContacts();
      setContacts([]);
      showFeedback('success', `📥 Downloaded ${contacts.length} contacts. All data has been cleared for privacy.`);
    } catch (error) {
      console.error('CSV download error:', error);
      showFeedback('error', 'Failed to download CSV file');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isExtracting) {
      handleExtractContact();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              LinkedIn Contact Extractor
            </h1>
            <p className="text-xl text-purple-100 max-w-2xl mx-auto">
              Extract and manage contact details from LinkedIn profiles using their direct URLs
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Feedback Message */}
        {feedback && (
          <div className={`mb-6 p-4 rounded-2xl shadow-sm whitespace-pre-line transform transition-all duration-300 ${
            feedback.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
            feedback.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
            feedback.type === 'warning' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
            'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {feedback.type === 'success' && (
                  <svg className="h-5 w-5 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {feedback.type === 'error' && (
                  <svg className="h-5 w-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{feedback.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* URL Input Section */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-8 border border-gray-100">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Extract Contact Information</h2>
            <p className="text-gray-600">Enter a LinkedIn profile URL or upload a file with multiple URLs</p>
          </div>
          
          <div className="flex flex-col gap-6">
            {/* Single URL Input */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="https://linkedin.com/in/username"
                  className="pl-10 w-full px-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none text-gray-900 placeholder-gray-400 transition-all duration-200"
                  disabled={isExtracting}
                />
              </div>
              <button
                onClick={handleExtractContact}
                disabled={isExtracting || (apiConfigured === false)}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center min-w-[200px]"
              >
                {isExtracting && !bulkProgress ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Extracting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Extract Contact
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">OR</span>
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Bulk Upload</h3>
                  <p className="text-sm text-gray-600">Upload a .txt file with LinkedIn URLs (one per line, max 100 URLs)</p>
                </div>
                <label className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    disabled={isExtracting}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isExtracting}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Choose File
                  </button>
                </label>
              </div>

              {/* Progress Bar */}
              {bulkProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Processing URLs...</span>
                    <span>{bulkProgress.current} / {bulkProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contacts List Section */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Saved Contacts
              </h2>
              <p className="text-gray-600">
                {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'} extracted
              </p>
            </div>
            <div className="flex gap-3">
              {contacts.some(contact => !contact.email && !contact.phone) && (
                <button
                  onClick={() => {
                    const contactsWithInfo = contacts.filter(contact => contact.email || contact.phone);
                    localStorage.setItem('linkedin_contacts', JSON.stringify(contactsWithInfo));
                    setContacts(contactsWithInfo);
                    showFeedback('info', 'Removed contacts without email or phone information');
                  }}
                  className="px-5 py-2.5 bg-amber-100 text-amber-700 rounded-xl font-medium hover:bg-amber-200 transition-colors duration-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clean Up
                </button>
              )}
              {contacts.length > 0 && (
                <button
                  onClick={handleDownloadCSV}
                  className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download CSV
                </button>
              )}
            </div>
          </div>

          {contacts.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No contacts yet</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Start by entering a LinkedIn profile URL above to extract contact information
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {contacts.map((contact) => (
                <div key={contact.id} className={`group relative overflow-hidden rounded-2xl border-2 p-6 transition-all duration-200 hover:shadow-lg ${
                  !contact.email && !contact.phone ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-white hover:border-purple-200'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-lg">{contact.name}</h3>
                          {!contact.email && !contact.phone && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                              No Contact Info
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        {/* Display all emails */}
                        {contact.emails && contact.emails.length > 0 ? (
                          <div className="space-y-1">
                            {contact.emails?.map((email, index) => (
                              <div key={`email-${index}`} className="flex items-center gap-2 text-gray-600">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span>{email}</span>
                                {index === 0 && contact.emails && contact.emails.length > 1 && (
                                  <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">Primary</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : contact.email ? (
                          <div className="flex items-center gap-2 text-gray-600">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span>{contact.email}</span>
                          </div>
                        ) : null}
                        
                        {/* Display all phone numbers */}
                        {contact.phones && contact.phones.length > 0 ? (
                          <div className="space-y-1">
                            {contact.phones?.map((phone, index) => (
                              <div key={`phone-${index}`} className="flex items-center gap-2 text-gray-600">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <span>{phone}</span>
                                {index === 0 && contact.phones && contact.phones.length > 1 && (
                                  <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Primary</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : contact.phone ? (
                          <div className="flex items-center gap-2 text-gray-600">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span>{contact.phone}</span>
                          </div>
                        ) : null}
                        
                        {!contact.email && !contact.phone && (
                          <div className="text-amber-600 text-sm italic">
                            Profile found but no contact information available
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 pt-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700 font-medium">
                            View LinkedIn Profile
                          </a>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <span className="text-xs text-gray-500">
                        {new Date(contact.extractedAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactExtractor; 