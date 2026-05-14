import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) return new NextResponse('Missing token', { status: 400 });

    await connectDB();

    // Look up the order using multiSubToken
    const order = await Order.findOne({ multiSubToken: token }).lean();
    if (!order) return new NextResponse('Invalid or expired subscription token', { status: 404 });

    // Validate provisioning
    if (order.vpnProvisionStatus !== 'provisioned' || !order.vpnKeys || order.vpnKeys.length === 0) {
      // Fallback: If it's an old order, multiSubToken shouldn't exist, but just in case
      if (order.vpnKey?.subLink) {
        const fallbackRes = await fetch(order.vpnKey.subLink, { next: { revalidate: 60 } });
        if (fallbackRes.ok) {
           const data = await fallbackRes.text();
           return new NextResponse(data, {
            headers: { 'Content-Type': 'text/plain', 'Cache-Control': 's-maxage=60' }
           });
        }
      }
      return new NextResponse('Subscription not active', { status: 403 });
    }

    // Check if expired
    const firstKey = order.vpnKeys[0] || order.vpnKey;
    if (firstKey.expiryTime && Date.now() > firstKey.expiryTime) {
       return new NextResponse('Subscription expired', { status: 403 });
    }

    const configs: string[] = [];

    // Fetch individual configs
    for (const key of order.vpnKeys) {
      if (!key.subLink) continue;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const res = await fetch(key.subLink, { 
          signal: controller.signal,
          next: { revalidate: 300 } // Cache per sublink 5 mins
        });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const b64Data = await res.text();
          // Decode
          const buff = Buffer.from(b64Data.trim(), 'base64');
          const text = buff.toString('utf-8');
          // Add to array, filtering out empty lines
          const lines = text.split('\n').filter(l => l.trim().length > 0);
          configs.push(...lines);
        }
      } catch (err) {
        // Ignore individual failures to allow partial fulfillment
        console.error(`Failed to fetch sublink for server ${key.serverId}:`, err);
      }
    }

    if (configs.length === 0) {
       return new NextResponse('No server configurations available right now. Please try again later.', { status: 503 });
    }

    // Re-encode final merged string
    const finalString = configs.join('\n');
    const finalBase64 = Buffer.from(finalString).toString('base64');

    return new NextResponse(finalBase64, {
      headers: { 
        'Content-Type': 'text/plain',
        'Cache-Control': 's-maxage=60' // small cache
      }
    });

  } catch (error) {
    console.error('Multi-server subscription error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
