import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { RotateConfig, getRotateConfig } from '@/models/RotateConfig';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';

// GET: Retrieve rotation configuration
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const config = await getRotateConfig();

    return NextResponse.json({
      success: true,
      data: { config },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update rotation configuration
export async function PATCH(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const body = await request.json();
    const config = await getRotateConfig();

    if (body.doToken1 !== undefined) config.doToken1 = body.doToken1;
    if (body.doToken2 !== undefined) config.doToken2 = body.doToken2;
    if (body.cfToken !== undefined) config.cfToken = body.cfToken;
    if (body.cfEmail !== undefined) config.cfEmail = body.cfEmail;
    if (body.xuiUsername !== undefined) config.xuiUsername = body.xuiUsername;
    if (body.xuiPassword !== undefined) config.xuiPassword = body.xuiPassword;
    if (body.enable2FA !== undefined) config.enable2FA = body.enable2FA;
    if (body.dropletSize !== undefined) config.dropletSize = body.dropletSize;
    if (body.dropletImage !== undefined) config.dropletImage = body.dropletImage;

    await config.save();

    return NextResponse.json({
      success: true,
      data: { config },
      message: 'Rotation configuration updated',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
