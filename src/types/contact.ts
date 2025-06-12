export interface Contact {
  id: string;
  linkedinUrl: string;
  name: string;
  email?: string;
  phone?: string;
  emails?: string[]; // All emails
  phones?: string[]; // All phone numbers
  extractedAt: string;
  // Additional fields from Wiza
  jobTitle?: string;
  company?: string;
  location?: string;
}

export interface ExtractionResult {
  success: boolean;
  contact?: Contact;
  error?: string;
} 