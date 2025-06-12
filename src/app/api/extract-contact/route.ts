import { NextRequest, NextResponse } from 'next/server';
import { extractContactWithWiza } from '@/utils/wiza';
import { getUser } from '@/utils/auth';
import { logActivity } from '@/utils/userDb';

export async function GET() {
  // Debug: Check if environment variables are loaded
  const apiKey = process.env.WIZA_API_KEY;
  console.log('API Key check:', {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length,
    nodeEnv: process.env.NODE_ENV
  });

  return NextResponse.json({ 
    message: 'LinkedIn Contact Extractor API',
    status: apiKey ? 'ready' : 'error',
    provider: 'Wiza API',
    configured: !!apiKey
  });
}

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { linkedinUrl } = await request.json();
    
    if (!linkedinUrl) {
      return NextResponse.json(
        { error: 'LinkedIn URL is required' },
        { status: 400 }
      );
    }

    // Validate LinkedIn URL format
    const linkedinUrlPattern = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-]+\/?$/;
    if (!linkedinUrlPattern.test(linkedinUrl)) {
      return NextResponse.json(
        { error: 'Invalid LinkedIn URL format. Please use format: https://linkedin.com/in/username' },
        { status: 400 }
      );
    }

    console.log('Extracting contact from LinkedIn URL:', linkedinUrl);

    // Use Wiza API for contact extraction
    const result = await extractContactWithWiza(linkedinUrl);

    // Save to database if successful
    if (result.success && result.contact) {
      try {
        const { saveExtractedContact } = await import('@/utils/userDb');
        await saveExtractedContact(user.id, {
          name: result.contact.name,
          title: result.contact.jobTitle || '',
          company: result.contact.company || '',
          emails: result.contact.emails || (result.contact.email ? [result.contact.email] : []),
          phones: result.contact.phones || (result.contact.phone ? [result.contact.phone] : []),
          linkedin_url: linkedinUrl
        });
      } catch (saveError) {
        console.error('Failed to save contact to database:', saveError);
        // Continue - don't fail the request if saving fails
      }
    }

    // Log the extraction activity
    await logActivity({
      user_id: user.id,
      username: user.username,
      action: 'extract_contact',
      linkedin_url: linkedinUrl,
      contact_name: result.contact?.name,
      success: result.success,
      details: result.success 
        ? `Extracted ${result.contact?.name || 'contact'} from LinkedIn`
        : `Failed: ${result.error || 'Unknown error'}`
    });

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        contact: result.contact 
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Failed to extract contact information' 
        },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Example implementation for real LinkedIn integration:
/*
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { linkedinUrl } = body;

    // Validate LinkedIn URL
    if (!isValidLinkedInUrl(linkedinUrl)) {
      return NextResponse.json(
        { success: false, error: 'Invalid LinkedIn URL' },
        { status: 400 }
      );
    }

    // Option 1: Use LinkedIn Sales Navigator API (requires enterprise account)
    // const contact = await extractWithSalesNavigator(linkedinUrl);

    // Option 2: Use third-party enrichment service
    // const contact = await enrichWithThirdParty(linkedinUrl);

    // Option 3: Ethical scraping with proper rate limiting and consent
    // const contact = await ethicalScraping(linkedinUrl);

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    console.error('LinkedIn extraction error:', error);
    return NextResponse.json(
      { success: false, error: 'Extraction failed' },
      { status: 500 }
    );
  }
}
*/ 