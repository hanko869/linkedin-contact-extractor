import Papa from 'papaparse';
import { Contact } from '@/types/contact';

export const generateCSV = (contacts: Contact[]): string => {
  const csvData = contacts.map(contact => ({
    name: contact.name || 'N/A',
    email: contact.email || 'N/A',
    all_emails: contact.emails?.join('; ') || contact.email || 'N/A',
    phone: contact.phone || 'N/A',
    all_phones: contact.phones?.join('; ') || contact.phone || 'N/A',
    linkedinUrl: contact.linkedinUrl,
    extractedAt: contact.extractedAt
  }));

  return Papa.unparse(csvData, {
    header: true,
    columns: ['name', 'email', 'all_emails', 'phone', 'all_phones', 'linkedinUrl', 'extractedAt']
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