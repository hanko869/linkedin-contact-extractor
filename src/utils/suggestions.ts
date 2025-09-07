// Suggestion data for autocomplete functionality

export const locationSuggestions = [
  // Countries
  'United States',
  'Canada', 
  'United Kingdom',
  'Australia',
  'Germany',
  'France',
  'India',
  'Singapore',
  'Netherlands',
  'Sweden',
  'Switzerland',
  'Japan',
  'Brazil',
  'Mexico',
  'South Africa',
  
  // States/Provinces with Country
  'California, United States',
  'New York, United States', 
  'Texas, United States',
  'Florida, United States',
  'Illinois, United States',
  'Ontario, Canada',
  'British Columbia, Canada',
  'Quebec, Canada',
  'England, United Kingdom',
  'Scotland, United Kingdom',
  'New South Wales, Australia',
  'Victoria, Australia',
  
  // Cities with State/Country
  'New York, NY, United States',
  'Los Angeles, CA, United States',
  'San Francisco, CA, United States',
  'Chicago, IL, United States',
  'Boston, MA, United States',
  'Miami, FL, United States',
  'Seattle, WA, United States',
  'Austin, TX, United States',
  'Denver, CO, United States',
  'Atlanta, GA, United States',
  'Toronto, ON, Canada',
  'Vancouver, BC, Canada',
  'Montreal, QC, Canada',
  'London, England, United Kingdom',
  'Manchester, England, United Kingdom',
  'Edinburgh, Scotland, United Kingdom',
  'Sydney, NSW, Australia',
  'Melbourne, VIC, Australia',
  'Brisbane, QLD, Australia',
  'Berlin, Germany',
  'Munich, Germany',
  'Paris, France',
  'Amsterdam, Netherlands',
  'Stockholm, Sweden',
  'Zurich, Switzerland',
  'Tokyo, Japan',
  'Singapore, Singapore',
  'Mumbai, India',
  'Bangalore, India',
  'São Paulo, Brazil',
  'Mexico City, Mexico',
  'Cape Town, South Africa'
];

export const jobTitleSuggestions = [
  // C-Level
  'CEO',
  'CTO', 
  'CFO',
  'COO',
  'CMO',
  'CHRO',
  'Chief Executive Officer',
  'Chief Technology Officer',
  'Chief Financial Officer',
  'Chief Operating Officer',
  'Chief Marketing Officer',
  'Chief Human Resources Officer',
  
  // Vice Presidents
  'VP',
  'Vice President',
  'VP of Sales',
  'VP of Marketing', 
  'VP of Engineering',
  'VP of Operations',
  'VP of Finance',
  'VP of Human Resources',
  'VP of Product',
  'VP of Business Development',
  
  // Directors
  'Director',
  'Sales Director',
  'Marketing Director',
  'Engineering Director',
  'Operations Director',
  'Finance Director',
  'HR Director',
  'Product Director',
  'Business Development Director',
  
  // Managers
  'Manager',
  'Sales Manager',
  'Marketing Manager',
  'Project Manager',
  'Product Manager',
  'Engineering Manager',
  'Operations Manager',
  'Finance Manager',
  'HR Manager',
  'Business Development Manager',
  'Account Manager',
  'Regional Manager',
  'General Manager',
  
  // Sales Roles
  'Sales Representative',
  'Sales Executive',
  'Account Executive',
  'Business Development Representative',
  'BDR',
  'SDR',
  'Sales Development Representative',
  'Inside Sales Representative',
  'Outside Sales Representative',
  'Regional Sales Manager',
  'Territory Manager',
  
  // Marketing Roles
  'Marketing Specialist',
  'Digital Marketing Manager',
  'Content Marketing Manager',
  'Social Media Manager',
  'SEO Manager',
  'PPC Manager',
  'Email Marketing Manager',
  'Brand Manager',
  'Product Marketing Manager',
  
  // Technical Roles
  'Software Engineer',
  'Senior Software Engineer',
  'Lead Developer',
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'DevOps Engineer',
  'Data Scientist',
  'Data Analyst',
  'System Administrator',
  'IT Manager',
  'Technical Lead',
  
  // Other Common Roles
  'Founder',
  'Co-Founder',
  'Owner',
  'President',
  'Partner',
  'Consultant',
  'Analyst',
  'Coordinator',
  'Specialist',
  'Associate',
  'Executive',
  'Administrator',
  'Assistant',
  'Supervisor'
];

export const commonFirstNames = [
  'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Jessica',
  'William', 'Ashley', 'James', 'Amanda', 'Christopher', 'Jennifer', 'Daniel', 'Lisa',
  'Matthew', 'Michelle', 'Anthony', 'Kimberly', 'Mark', 'Amy', 'Donald', 'Angela',
  'Steven', 'Helen', 'Paul', 'Anna', 'Andrew', 'Brenda', 'Joshua', 'Emma',
  'Kenneth', 'Olivia', 'Kevin', 'Cynthia', 'Brian', 'Marie', 'George', 'Janet',
  'Edward', 'Catherine', 'Ronald', 'Frances', 'Timothy', 'Christine', 'Jason', 'Samantha',
  'Jeffrey', 'Deborah', 'Ryan', 'Rachel', 'Jacob', 'Carolyn', 'Gary', 'Janet',
  'Nicholas', 'Virginia', 'Eric', 'Maria', 'Jonathan', 'Heather', 'Stephen', 'Diane',
  'Larry', 'Julie', 'Justin', 'Joyce', 'Scott', 'Victoria', 'Brandon', 'Kelly',
  'Benjamin', 'Christina', 'Samuel', 'Joan', 'Gregory', 'Evelyn', 'Alexander', 'Lauren',
  'Frank', 'Judith', 'Raymond', 'Megan', 'Jack', 'Cheryl', 'Dennis', 'Andrea',
  'Jerry', 'Hannah', 'Tyler', 'Jacqueline', 'Aaron', 'Martha', 'Jose', 'Gloria'
];

export const commonLastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
  'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
  'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy',
  'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey',
  'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza',
  'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers'
];

// Function to filter suggestions based on input
export const filterSuggestions = (suggestions: string[], input: string, maxResults: number = 10): string[] => {
  if (!input.trim()) return [];
  
  const lowerInput = input.toLowerCase();
  
  // First, find exact matches at the beginning
  const exactMatches = suggestions.filter(suggestion => 
    suggestion.toLowerCase().startsWith(lowerInput)
  );
  
  // Then, find matches anywhere in the string
  const containsMatches = suggestions.filter(suggestion => 
    suggestion.toLowerCase().includes(lowerInput) && 
    !suggestion.toLowerCase().startsWith(lowerInput)
  );
  
  // Combine and limit results
  return [...exactMatches, ...containsMatches]
    .slice(0, maxResults)
    .sort((a, b) => a.length - b.length); // Shorter suggestions first
};