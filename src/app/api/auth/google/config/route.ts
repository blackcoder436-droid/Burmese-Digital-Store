import { NextResponse } from 'next/server';

// GET /api/auth/google/config
// Returns runtime Google client ID for browser initialization.
// Helps avoid build-time NEXT_PUBLIC env mismatch in production.
export async function GET() {
  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    '';

  return NextResponse.json({
    success: true,
    data: {
      enabled: Boolean(clientId),
      clientId,
    },
  });
}
