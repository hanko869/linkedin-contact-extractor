import { NextRequest, NextResponse } from 'next/server';
import { searchProspects } from '@/utils/wiza';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, jobTitle, location, size = 20 } = body;

    console.log('Prospect search request:', { firstName, lastName, jobTitle, location, size });

    // Validate at least one search parameter is provided
    if (!firstName && !lastName && !jobTitle && !location) {
      return NextResponse.json({
        success: false,
        error: 'At least one search parameter (firstName, lastName, jobTitle, or location) is required'
      }, { status: 400 });
    }

    // Call the Wiza search function
    const searchResults = await searchProspects(
      firstName,
      lastName,
      jobTitle,
      location,
      Math.min(size, 30) // Max 30 as per API limits
    );

    return NextResponse.json({
      success: true,
      total: searchResults.data?.total || 0,
      profiles: searchResults.data?.profiles || []
    });

  } catch (error) {
    console.error('Prospect search error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to search prospects';
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}


