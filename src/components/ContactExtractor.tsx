'use client';

import React, { useState, useEffect } from 'react';
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
  const [apiStatus, setApiStatus] = useState<'connected' | 'error'>('connected');

  // Load contacts from localStorage and check API configuration on component mount
  useEffect(() => {
    setContacts(getStoredContacts());
    
    // Check API configuration for Wiza
    checkAPIConfiguration().then(configured => {
      setApiConfigured(configured);
      setApiStatus(configured ? 'connected' : 'error');
    });
  }, []);

  const showFeedback = (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 7000); // Extended timeout for longer messages
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
    showFeedback('info', 'Extracting contact information using Wiza API...');

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
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* API Status Indicator */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-8">
          {apiStatus === 'connected' && (
            <div className="flex items-center justify-center gap-2 text-green-600 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Wiza API Connected & Ready
            </div>
          )}
          {apiStatus === 'error' && (
            <div className="flex items-center justify-center gap-2 text-red-600 text-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              Wiza API Connection Error - Check API Key
            </div>
          )}
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div className={`mb-6 p-4 rounded-lg shadow-sm whitespace-pre-line ${
            feedback.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' :
            feedback.type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' :
            feedback.type === 'warning' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
            'bg-blue-100 text-blue-700 border border-blue-200'
          }`}>
            {feedback.message}
          </div>
        )}

        {/* URL Input Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Paste LinkedIn profile URL here (e.g., https://linkedin.com/in/username)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 placeholder-gray-400"
              disabled={isExtracting}
            />
            <button
              onClick={handleExtractContact}
              disabled={isExtracting || (apiConfigured === false)}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center min-w-[180px]"
            >
              {isExtracting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Extracting...
                </>
              ) : (
                'Extract Contact Info'
              )}
            </button>
          </div>
          <div className="mt-3 text-sm text-gray-500">
            <p>🔗 Using Wiza API for real contact extraction. {apiConfigured === false && '⚠️ API key required.'}</p>
          </div>
        </div>

        {/* Contacts List Section */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">
              Stored Contacts ({contacts.length})
            </h2>
            <div className="flex gap-2">
              {contacts.some(contact => !contact.email && !contact.phone) && (
                <button
                  onClick={() => {
                    const contactsWithInfo = contacts.filter(contact => contact.email || contact.phone);
                    localStorage.setItem('linkedin_contacts', JSON.stringify(contactsWithInfo));
                    setContacts(contactsWithInfo);
                    showFeedback('info', 'Removed contacts without email or phone information');
                  }}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors duration-200 text-sm"
                >
                  Clean Up
                </button>
              )}
              {contacts.length > 0 && (
                <button
                  onClick={handleDownloadCSV}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors duration-200 flex items-center gap-2"
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
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-500 text-lg">No contacts extracted yet</p>
              <p className="text-gray-400 text-sm">Extract contact information from LinkedIn profiles to see them here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact) => (
                <div key={contact.id} className={`border rounded-lg p-4 hover:shadow-md transition-shadow duration-200 ${!contact.email && !contact.phone ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-800">{contact.name}</h3>
                        {!contact.email && !contact.phone && (
                          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                            No Contact Info
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm">
                        {/* Display all emails */}
                        {contact.emails && contact.emails.length > 0 ? (
                          <div className="space-y-1">
                            {contact.emails?.map((email, index) => (
                              <div key={`email-${index}`} className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="text-gray-600">{email}</span>
                                {index === 0 && contact.emails && contact.emails.length > 1 && <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Primary</span>}
                              </div>
                            ))}
                          </div>
                        ) : contact.email ? (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="text-gray-600">{contact.email}</span>
                          </div>
                        ) : null}
                        
                        {/* Display all phone numbers */}
                        {contact.phones && contact.phones.length > 0 ? (
                          <div className="space-y-1">
                            {contact.phones?.map((phone, index) => (
                              <div key={`phone-${index}`} className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <span className="text-gray-600">{phone}</span>
                                {index === 0 && contact.phones && contact.phones.length > 1 && <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">Primary</span>}
                              </div>
                            ))}
                          </div>
                        ) : contact.phone ? (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="text-gray-600">{contact.phone}</span>
                          </div>
                        ) : null}
                        {!contact.email && !contact.phone && (
                          <div className="text-orange-600 text-sm italic">
                            Profile found but no contact information available
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            LinkedIn Profile
                          </a>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-0 sm:ml-4">
                      <span className="text-xs text-gray-400">
                        Extracted: {new Date(contact.extractedAt).toLocaleDateString()}
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