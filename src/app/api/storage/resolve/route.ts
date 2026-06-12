import { NextRequest, NextResponse } from 'next/server';
import { resolveStorageUrl } from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    if (!url) {
      return NextResponse.json({ success: false, error: 'Missing URL parameter' }, { status: 400 });
    }

    const resolved = await resolveStorageUrl(url);
    return NextResponse.json({ success: true, url: resolved });
  } catch (error: any) {
    console.error('Storage resolve error:', error);
    return NextResponse.json({ success: false, error: 'Unable to resolve storage URL' }, { status: 500 });
  }
}
