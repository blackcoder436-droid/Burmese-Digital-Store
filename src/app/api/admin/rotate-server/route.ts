import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { spawn } from 'child_process';
import path from 'path';

// POST: Trigger Server Rotation Background Job
export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const serverId = body.serverId;

    if (!serverId) {
      return NextResponse.json({ success: false, error: 'Server ID is required' }, { status: 400 });
    }

    // Here we will spawn the background script, passing the serverId
    // Because it uses TS modules, we run it using tsx or ts-node
    const scriptPath = path.join(process.cwd(), 'scripts', 'rotate-vpn.ts'); // Changed to .ts to easily consume mongoose models
    
    // Spawn the Node script detatched so it keeps running
    const child = spawn('npx', ['tsx', scriptPath, serverId], {
      detached: true,
      stdio: 'ignore', // Ignore stdio to let it run completely independent
    });
    
    child.unref(); // Allow the parent Node (Next.js server) to exit without waiting

    // We can also save a generic "status" to DB if we want, but for now just launching it.

    return NextResponse.json({
      success: true,
      message: `Rotation process started in background for ${serverId}`,
    });
  } catch (error: any) {
    if (error.message === 'Admin access required') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Rotate server trigger error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
