# Location and Education Feature

## Overview
Added support for displaying location and education information from LinkedIn profiles in the contact extraction tool.

## What's New

### 1. **Location Support** ✅
- Location data is now extracted from the Wiza API response
- Displayed in the contact card with a location pin icon
- Included in CSV exports
- The Wiza API provides location information for most LinkedIn profiles

### 2. **Education Support** ⚠️
- Education field has been added to the Contact interface
- UI is ready to display education information with a graduation cap icon
- CSV export includes an education column
- **Important Note**: The Wiza API does NOT currently provide education data
- The field is included for potential future use if Wiza adds this data

## Testing the Feature

1. **Start the development server**:
   ```powershell
   cd linkedin-contact-extractor
   npm run dev
   ```

2. **Open the application**: Navigate to http://localhost:3000

3. **Test with a LinkedIn URL**:
   - Enter a LinkedIn profile URL (e.g., https://www.linkedin.com/in/some-profile/)
   - Click "Extract Contact"
   - Wait for the extraction to complete

4. **What you should see**:
   - Contact name
   - Email(s) if available
   - Phone number(s) if available
   - **Job Title and Company** (if available)
   - **Location** (if available) - displayed with a location pin icon
   - Education will NOT appear (as Wiza doesn't provide this data)

5. **CSV Export**:
   - Click "Download CSV" after extracting contacts
   - The CSV will include columns for:
     - name
     - email1, email2, etc.
     - phone1, phone2, etc.
     - jobTitle
     - company
     - location
     - education (will be empty)
     - linkedinUrl
     - extractedAt

## Example Output

When you extract a contact, you might see:

```
John Doe
✉️ john.doe@company.com
📱 +1 (555) 123-4567
💼 Senior Software Engineer at Tech Company
📍 San Francisco, California, United States
🔗 View LinkedIn Profile
```

## Known Limitations

1. **Education Data**: Not available from Wiza API
2. **Location Format**: Depends on what's listed on the LinkedIn profile
3. **API Credits**: Each extraction uses Wiza API credits

## Future Enhancements

If Wiza adds education data to their API in the future, the application is already prepared to display it. No code changes would be needed on the frontend. 