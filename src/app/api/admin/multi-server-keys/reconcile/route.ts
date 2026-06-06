import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import dbConnect from '@/lib/mongodb';
import { createLogger } from '@/lib/logger';
import { reconcileMultiServerKey } from '@/lib/vpn-reconciliation';

const log = createLogger({ route: '/api/admin/multi-server-keys/reconcile' });

function toObjectId(id: string) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.trim() || '';
    const objectId = toObjectId(id);

    if (!objectId) {
      return NextResponse.json({ success: false, error: 'Missing or invalid record id' }, { status: 400 });
    }

    const mongooseConn = await dbConnect();
    const db = mongooseConn.connection.getClient().db();
    const record = await db.collection('vpn_keys').findOne({ _id: objectId });

    if (!record) {
      return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
    }

    const report = await reconcileMultiServerKey(record);

    return NextResponse.json({
      success: true,
      data: {
        record: {
          ...record,
          _id: String(record._id),
        },
        report,
      },
    });
  } catch (error) {
    log.error('Admin multi-server key reconciliation error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: 'Failed to reconcile key' }, { status: 500 });
  }
}
