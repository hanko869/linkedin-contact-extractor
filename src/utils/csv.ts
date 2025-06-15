import Papa from 'papaparse';
import { Contact } from '@/types/contact';

export const generateCSV = (contacts: Contact[]): string => {
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
  
  columns.push('linkedinUrl', 'extractedAt');

  // Map contacts to CSV data with separate columns for each email and phone
  const csvData = contacts.map(contact => {
    const row: any = {
      name: contact.name || 'N/A',
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