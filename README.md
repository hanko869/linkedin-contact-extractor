# LinkedIn Contact Extractor

A modern, intuitive web application that allows users to extract and manage contact details (email and phone numbers) from LinkedIn profiles using **PeopleDataLabs API**. Built with Next.js, TypeScript, and Tailwind CSS.

![LinkedIn Contact Extractor](https://img.shields.io/badge/Built%20with-Next.js-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)
![Tailwind CSS](https://img.shields.io/badge/Styled%20with-Tailwind%20CSS-38B2AC.svg)
![PeopleDataLabs](https://img.shields.io/badge/Powered%20by-PeopleDataLabs-blue.svg)

## 🚀 Features

### Core Functionality
- **LinkedIn Profile URL Input**: Clean, intuitive interface for pasting LinkedIn profile URLs
- **Real Contact Extraction**: Uses PeopleDataLabs API for legitimate contact data enrichment
- **Demo Mode**: Optional simulation mode for testing without API costs
- **Real-time Validation**: Instant feedback for invalid URLs or extraction failures
- **Automatic Storage**: Extracted contacts are automatically saved to local storage
- **Contact Management**: View all stored contacts in a clean, organized list
- **CSV Export**: Download all contacts as a CSV file with one click
- **Privacy-First**: All data is cleared immediately after CSV download

### User Experience
- **API Status Indicator**: Clear visual feedback about API configuration status
- **Mode Selection**: Switch between real API and simulation modes
- **Loading States**: Visual feedback during contact extraction process
- **Error Handling**: Comprehensive error messages and user guidance
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Modern UI**: Clean, professional interface with smooth animations

### Security & Privacy
- **Legitimate Data Provider**: Uses PeopleDataLabs - a professional, GDPR-compliant service
- **Client-Side Storage**: Data stored locally in browser's localStorage
- **Automatic Data Clearing**: All data removed after CSV download
- **No Server Storage**: No sensitive data stored on external servers
- **Rate Limiting**: Built-in protection against API overuse

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 with React 18
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS for responsive design
- **Data Provider**: PeopleDataLabs API for contact enrichment
- **CSV Processing**: PapaParse for CSV generation
- **Storage**: Browser localStorage
- **Icons**: Heroicons for consistent iconography

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- PeopleDataLabs API key (optional for demo mode)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd linkedin-contact-extractor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env.local
   
   # Edit .env.local with your actual values
   nano .env.local
   ```

4. **Set up PeopleDataLabs API (Optional)**
   - Sign up at [https://peopledatalabs.com/](https://peopledatalabs.com/)
   - Get your API key from the dashboard
   - Add it to `.env.local`:
     ```
     PEOPLEDATALABS_API_KEY=your_actual_api_key_here
     NEXT_PUBLIC_USE_SIMULATION=false
     ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   Navigate to `http://localhost:3000` to view the application

## 🔧 Configuration Options

### Environment Variables

Create a `.env.local` file with these variables:

```bash
# PeopleDataLabs API Configuration
PEOPLEDATALABS_API_KEY=your_api_key_here

# API Base URL (optional)
PEOPLEDATALABS_BASE_URL=https://api.peopledatalabs.com/v5

# Application Mode
NEXT_PUBLIC_USE_SIMULATION=false  # Set to 'true' for demo mode
```

### Operating Modes

**🔗 Real API Mode** (`NEXT_PUBLIC_USE_SIMULATION=false`)
- Uses PeopleDataLabs API for actual contact extraction
- Requires valid API key
- Costs apply per successful extraction
- Higher accuracy and real data

**📝 Demo Mode** (`NEXT_PUBLIC_USE_SIMULATION=true`)
- Uses simulated contact data
- No API key required
- No costs
- Perfect for testing and demonstrations

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality

## 📋 How to Use

### Getting Started

1. **Choose Your Mode**:
   - **Demo Mode**: Set `NEXT_PUBLIC_USE_SIMULATION=true` for testing
   - **Real Mode**: Get PeopleDataLabs API key and set `NEXT_PUBLIC_USE_SIMULATION=false`

2. **Check API Status**: Look for the status indicator at the top of the page:
   - 🟢 Green: API connected and ready
   - 🟡 Yellow: Demo mode active
   - 🔴 Red: API not configured

### Extracting Contacts

1. **Enter LinkedIn URL**: Paste a LinkedIn profile URL in the input field
   - Format: `https://linkedin.com/in/username`
   - The app validates the URL format in real-time

2. **Extract Information**: Click "Extract Contact Info" button
   - Real mode: Uses PeopleDataLabs API for actual data
   - Demo mode: Generates realistic simulated data
   - Loading spinner shows extraction progress
   - Success/error feedback displayed immediately

3. **View Results**: Extracted contacts appear in the stored contacts list
   - Contact name, email, phone, and LinkedIn URL displayed
   - Extraction timestamp shown for each contact

### Managing Contacts

1. **View Stored Contacts**: All extracted contacts display in a clean list format
2. **Download CSV**: Click "Download CSV" to export all contacts
3. **Automatic Cleanup**: Data is cleared immediately after download for privacy

## 🏗️ Project Structure

```
linkedin-contact-extractor/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── api/               # API routes
│   │   │   └── extract-contact/
│   │   │       └── route.ts   # PeopleDataLabs integration
│   │   ├── layout.tsx         # Root layout component
│   │   ├── page.tsx           # Home page
│   │   └── globals.css        # Global styles
│   ├── components/            # React components
│   │   └── ContactExtractor.tsx # Main application component
│   ├── types/                 # TypeScript type definitions
│   │   └── contact.ts         # Contact interface definitions
│   └── utils/                 # Utility functions
│       ├── storage.ts         # localStorage management
│       ├── csv.ts            # CSV generation and download
│       ├── extraction.ts     # Contact extraction logic
│       └── peopledatalabs.ts # PeopleDataLabs API integration
├── .env.example              # Environment variables template
├── .env.local               # Your actual environment variables (gitignored)
├── package.json             # Dependencies and scripts
├── tailwind.config.ts       # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── README.md              # Project documentation
```

## 🔍 Implementation Details

### Contact Data Structure
```typescript
interface Contact {
  id: string;           // Unique identifier
  linkedinUrl: string;  // Original LinkedIn URL
  email?: string;       // Extracted email (optional)
  phone?: string;       // Extracted phone (optional)
  name?: string;        // Contact name (optional)
  extractedAt: string;  // ISO timestamp of extraction
}
```

### PeopleDataLabs Integration
- **Person Enrichment API**: Primary method for contact extraction
- **Search API**: Fallback method when enrichment fails
- **Rate Limiting**: Built-in 1.1-second intervals between requests
- **Error Handling**: Comprehensive handling of API responses and errors
- **Cost Management**: Clear feedback about API usage

### Storage Management
- Uses browser's `localStorage` for client-side data persistence
- Implements error handling for storage operations
- Provides utility functions for save, retrieve, and clear operations
- No server-side data storage for privacy

### CSV Export
- Generates CSV using PapaParse library
- Includes headers: name, email, phone, linkedinUrl, extractedAt
- Handles missing data with "N/A" placeholders
- Automatic file download with timestamp in filename

## 💰 Cost Considerations

### PeopleDataLabs Pricing
- Pay-per-successful-match model
- Typical costs: $0.05-$0.15 per successful contact extraction
- Free trial credits available for new users
- No charges for failed extractions

### Cost Optimization Tips
1. **Use Demo Mode** for development and testing
2. **Validate URLs** before extraction to avoid unnecessary API calls
3. **Monitor Usage** through PeopleDataLabs dashboard
4. **Cache Results** locally to avoid duplicate extractions

## ⚠️ Important Considerations

### Legal & Compliance
- **PeopleDataLabs Compliance**: Uses a legitimate, GDPR-compliant data provider
- **No LinkedIn ToS Violations**: Doesn't scrape LinkedIn directly
- **Data Sources**: PeopleDataLabs aggregates from public sources legally
- **User Consent**: Consider implementing user consent for contact extraction

### Production Deployment
For production deployment:

1. **Environment Setup**:
   ```bash
   PEOPLEDATALABS_API_KEY=your_production_api_key
   NEXT_PUBLIC_USE_SIMULATION=false
   ```

2. **API Key Security**:
   - Store API keys securely (never in client-side code)
   - Use environment variables or secure key management
   - Monitor API usage and set up billing alerts

3. **Rate Limiting**:
   - Implement additional rate limiting if needed
   - Monitor API quotas and usage patterns
   - Consider implementing user authentication for usage tracking

## 🚀 Deployment

### Vercel (Recommended)
1. Push code to GitHub repository
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `PEOPLEDATALABS_API_KEY`
   - `NEXT_PUBLIC_USE_SIMULATION`
4. Deploy automatically with zero configuration

### Manual Deployment
```bash
npm run build
npm run start
```

### Environment Variables for Production
```bash
PEOPLEDATALABS_API_KEY=your_production_api_key
PEOPLEDATALABS_BASE_URL=https://api.peopledatalabs.com/v5
NEXT_PUBLIC_USE_SIMULATION=false
```

## 🧪 Testing

### Demo Mode Testing
1. Set `NEXT_PUBLIC_USE_SIMULATION=true`
2. Test with various LinkedIn URLs
3. Verify simulation behavior and UI feedback

### API Mode Testing
1. Get PeopleDataLabs API key
2. Set `NEXT_PUBLIC_USE_SIMULATION=false`
3. Test with real LinkedIn profiles
4. Monitor API usage in PeopleDataLabs dashboard

### Test URLs for Demo
```
https://linkedin.com/in/johndoe
https://linkedin.com/in/jane-smith
https://linkedin.com/in/tech-professional
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Test in both simulation and API modes
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

If you encounter any issues:

### Common Issues
1. **API Key Not Working**: Verify your PeopleDataLabs API key is valid
2. **No Results Found**: Try different LinkedIn profiles or check API credits
3. **Rate Limiting**: Wait between requests or check your API limits
4. **Build Errors**: Ensure all environment variables are properly set

### Getting Help
1. Check the existing issues in the repository
2. Create a new issue with detailed description
3. Include steps to reproduce any bugs
4. Mention whether you're using demo or API mode

## 🔮 Future Enhancements

- [ ] **Bulk Processing**: Upload CSV of LinkedIn URLs for batch processing
- [ ] **Contact Deduplication**: Automatically detect and merge duplicate contacts
- [ ] **Enhanced Filtering**: Filter contacts by email domain, location, etc.
- [ ] **Export Formats**: Support for Excel, JSON, and other formats
- [ ] **Contact Enrichment**: Additional data points (company, job title, etc.)
- [ ] **API Usage Dashboard**: Track costs and usage patterns
- [ ] **Advanced Search**: Search contacts by various criteria
- [ ] **Contact Validation**: Verify email addresses and phone numbers
- [ ] **Integration Options**: Webhook support for external systems
- [ ] **User Authentication**: Multi-user support with individual API quotas

---

**Built with ❤️ using Next.js, TypeScript, and PeopleDataLabs API**

*Legitimate, compliant, and professional contact extraction made simple.*
