import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';

// GET /api/health — App health check endpoint
export async function GET() {
  const start = Date.now();

  let dbStatus = 'unknown';
  try {
    await connectDB();
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  const uptime = process.uptime();
  const latency = Date.now() - start;

  const healthy = dbStatus === 'connected';

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime),
      latency: `${latency}ms`,
      services: {
        database: dbStatus,
      },
      version: process.env.npm_package_version || '1.0.0',
    },
    { status: healthy ? 200 : 503 }
  );
}
