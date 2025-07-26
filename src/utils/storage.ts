import { Contact } from '@/types/contact';

const STORAGE_KEY = 'linkedin_contacts';

export const saveContact = (contact: Contact): void => {
  try {
    const existingContacts = getStoredContacts();
    const updatedContacts = [...existingContacts, contact];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedContacts));
  } catch (error) {
    console.error('Error saving contact to localStorage:', error);
  }
};

export const getStoredContacts = (): Contact[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const contacts: Contact[] = JSON.parse(stored);
    
    // Clean up any contacts that might have email/phone as objects
    return contacts.map(contact => ({
      ...contact,
      // Ensure emails array contains only strings
      emails: contact.emails?.map(email => 
        typeof email === 'object' && email !== null && 'email' in email 
          ? (email as any).email 
          : String(email)
      ).filter(email => email && email !== 'undefined' && email !== 'null') || [],
      
      // Ensure phones array contains only strings
      phones: contact.phones?.map(phone => 
        typeof phone === 'object' && phone !== null && 'phone' in phone 
          ? (phone as any).phone 
          : String(phone)
      ).filter(phone => phone && phone !== 'undefined' && phone !== 'null') || [],
      
      // Ensure email and phone are strings
      email: typeof contact.email === 'object' && contact.email !== null && 'email' in contact.email
        ? (contact.email as any).email
        : (contact.email || ''),
      
      phone: typeof contact.phone === 'object' && contact.phone !== null && 'phone' in contact.phone
        ? (contact.phone as any).phone
        : (contact.phone || '')
    }));
  } catch (error) {
    console.error('Error retrieving contacts from localStorage:', error);
    return [];
  }
};

export const clearStoredContacts = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing contacts from localStorage:', error);
  }
};

export const getContactCount = (): number => {
  return getStoredContacts().length;
}; 