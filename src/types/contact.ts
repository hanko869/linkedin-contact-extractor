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
  education?: string; // Note: Not available from Wiza API, kept for potential future use
}

export interface ExtractionResult {
  success: boolean;
  contact?: Contact;
  error?: string;
} 