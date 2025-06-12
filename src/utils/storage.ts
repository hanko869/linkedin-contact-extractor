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
    return stored ? JSON.parse(stored) : [];
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