import { NextRequest, NextResponse } from 'next/server';
import { searchProspects, searchProspectsUnlimited } from '@/utils/wiza';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstNames = [], lastNames = [], jobTitles = [], locations = [], size = 100 } = body;

    console.log('Prospect search request:', { firstNames, lastNames, jobTitles, locations, size });

    // Validate at least one search parameter is provided
    if (firstNames.length === 0 && lastNames.length === 0 && jobTitles.length === 0 && locations.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'At least one search parameter (firstNames, lastNames, jobTitles, or locations) is required'
      }, { status: 400 });
    }

    // Use unlimited search for all requests (it will choose the right strategy internally)
    const searchResults = await searchProspectsUnlimited(
      firstNames,
      lastNames,
      jobTitles,
      locations,
      size
    );

    return NextResponse.json({
      success: true,
      total: searchResults.total || 0,
      profiles: searchResults.profiles || []
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


