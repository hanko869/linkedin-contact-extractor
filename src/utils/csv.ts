import Papa from 'papaparse';
import { Contact } from '@/types/contact';

// Overloaded function for prospect search data
export function generateCSV(data: Record<string, any>[], headers: Record<string, string>): string;
// Original function for contact extractor
export function generateCSV(contacts: Contact[]): string;
export function generateCSV(dataOrContacts: any[], headers?: Record<string, string>): string {
  // If headers are provided, it's prospect search data
  if (headers) {
    const data = dataOrContacts as Record<string, any>[];
    return Papa.unparse(data, {
      header: true,
      columns: Object.keys(headers),
      transform: {
        // Transform column headers
        ...Object.entries(headers).reduce((acc, [key, displayName]) => {
          acc[key] = displayName;
          return acc;
        }, {} as Record<string, string>)
      }
    });
  }
  
  // Otherwise, use the original contact extractor logic
  const contacts = dataOrContacts as Contact[];
  // Find the maximum number of emails and phones across all contacts
  let maxEmails = 0;
  let maxPhones = 0;
  
  contacts.forEach(contact => {
    const emailCount = contact.emails?.length || (contact.email ? 1 : 0);
    const phoneCount = contact.phones?.length || (contact.phone ? 1 : 0);
    maxEmails = Math.max(maxEmails, emailCount);
    maxPhones = Math.max(maxPhones, phoneCount);
  });

  // Create column headers dynamically
  const columns = ['name'];
  
  // Add email columns
  for (let i = 1; i <= maxEmails; i++) {
    columns.push(`email${i}`);
  }
  
  // Add phone columns
  for (let i = 1; i <= maxPhones; i++) {
    columns.push(`phone${i}`);
  }
  
  columns.push('jobTitle', 'company', 'location', 'education', 'linkedinUrl', 'extractedAt');

  // Map contacts to CSV data with separate columns for each email and phone
  const csvData = contacts.map(contact => {
    const row: any = {
      name: contact.name || 'N/A',
      jobTitle: contact.jobTitle || '',
      company: contact.company || '',
      location: contact.location || '',
      education: contact.education || '',
      linkedinUrl: contact.linkedinUrl,
      extractedAt: contact.extractedAt
    };

    // Add emails to separate columns
    const emails = contact.emails || (contact.email ? [contact.email] : []);
    for (let i = 0; i < maxEmails; i++) {
      row[`email${i + 1}`] = emails[i] || '';
    }

    // Add phones to separate columns
    const phones = contact.phones || (contact.phone ? [contact.phone] : []);
    for (let i = 0; i < maxPhones; i++) {
      row[`phone${i + 1}`] = phones[i] || '';
    }

    return row;
  });

  return Papa.unparse(csvData, {
    header: true,
    columns: columns
  });
};

export const downloadCSV = (csvContent: string, filename: string = 'linkedin_contacts.csv'): void => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}; 