import { NextRequest, NextResponse } from 'next/server';
import whois from 'whois-json';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain');

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    // Convert domain to lowercase
    const normalizedDomain = domain.toLowerCase().trim();

    // Do the whois lookup
    const results = await whois(normalizedDomain, { follow: 3 }) as any;
    
    // Most unavailable domains will have a "registrar", "creationDate", "domainName", or exist in status
    const isAvailable = (
      results.status === 'available' || 
      (results.domainName === undefined && !results.registrar)
    );

    // some extensions return different keys. If "domainName" is missing, we consider it available basically.
    // However, some might say "No match for domain"
    const textData = JSON.stringify(results).toLowerCase();
    const notFoundKeywords = ['no match', 'not found', 'available', 'no data found'];
    const isActuallyAvailable = isAvailable || notFoundKeywords.some(k => textData.includes(k));

    return NextResponse.json({
      domain: normalizedDomain,
      available: isActuallyAvailable,
      data: results
    });

  } catch (error) {
    console.error('Domain check error:', error);
    // If lookup fails entirely (e.g. timeout), assume unavailable for safety, or return error.
    return NextResponse.json({ error: 'Failed to check domain.' }, { status: 500 });
  }
}
