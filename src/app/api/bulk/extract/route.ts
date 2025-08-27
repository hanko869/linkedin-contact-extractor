import { NextRequest, NextResponse } from 'next/server';
import { extractContactsInParallel } from '@/utils/wiza';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const urls: string[] = Array.isArray(body?.urls) ? body.urls : [];

    if (!urls || urls.length === 0) {
      return NextResponse.json({ success: false, error: 'No URLs provided' }, { status: 400 });
    }

    // Limit to a reasonable maximum to avoid abuse
    const MAX_BULK_URLS = 500;
    if (urls.length > MAX_BULK_URLS) {
      return NextResponse.json({ success: false, error: `Too many URLs. Maximum ${MAX_BULK_URLS} allowed.` }, { status: 400 });
    }

    // Execute on server so API keys remain private
    const resultsMap = await extractContactsInParallel(urls);

    const results: Array<{ url: string; success: boolean; contact?: any; error?: string }> = [];
    resultsMap.forEach((result, url) => {
      results.push({ url, success: result.success, contact: result.contact, error: result.error });
    });

    return NextResponse.json({ success: true, count: results.length, results });
  } catch (error) {
    console.error('Bulk extract API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}


