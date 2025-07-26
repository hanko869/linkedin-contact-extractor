import { NextResponse } from 'next/server';
import { getApiKeyHealthStatus } from '@/utils/wiza';

export async function GET() {
  try {
    const healthStatus = getApiKeyHealthStatus();
    
    return NextResponse.json({
      success: true,
      ...healthStatus,
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get API key health status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 