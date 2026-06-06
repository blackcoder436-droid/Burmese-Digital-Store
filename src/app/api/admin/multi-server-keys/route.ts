import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import dbConnect from '@/lib/mongodb';
import { createLogger } from '@/lib/logger';
import {
  mutateMultiServerKeyPanels,
  type PanelMutationUpdates,
} from '@/lib/multi-server-key-panel-actions';

const log = createLogger({ route: '/api/admin/multi-server-keys' });

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  try {
    const mongoose = await dbConnect();
    const db = mongoose.connection.getClient().db();
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '30')));
    const status = url.searchParams.get('status') || 'all';
    const queryValue = url.searchParams.get('q')?.trim() || '';

    const baseQuery: Record<string, unknown> = {
      $or: [
        { keyType: 'migrated_web' },
        { serverSubLinks: { $exists: true, $ne: [] } },
        { serverConfigLinks: { $exists: true, $ne: [] } },
      ],
    };

    const query: any = { ...baseQuery };
    if (status !== 'all') {
      query.status = status;
    }

    if (queryValue) {
      query.$and = [
        baseQuery,
        {
          $or: [
            { token: { $regex: queryValue, $options: 'i' } },
            { username: { $regex: queryValue, $options: 'i' } },
          ],
        },
      ];
      if (status !== 'all') {
        query.$and.push({ status });
      }
    }

    const keys = await db
      .collection('vpn_keys')
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const total = await db.collection('vpn_keys').countDocuments(query);
    const [activeCount, expiredCount, disabledCount] = await Promise.all([
      db.collection('vpn_keys').countDocuments({ ...baseQuery, status: 'active' }),
      db.collection('vpn_keys').countDocuments({ ...baseQuery, status: 'expired' }),
      db.collection('vpn_keys').countDocuments({ ...baseQuery, status: 'disabled' }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        keys: keys.map((record) => ({
          ...record,
          _id: String(record._id),
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
        summary: {
          active: activeCount,
          expired: expiredCount,
          disabled: disabledCount,
          total,
        },
      },
    });
  } catch (error) {
    log.error('Admin multi-server keys error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Failed to fetch multi-server keys' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, expiryTime, dataLimitGB, status, devices } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing record id' }, { status: 400 });
    }

    const updates: PanelMutationUpdates = {};
    if (expiryTime !== undefined) {
      if (typeof expiryTime !== 'number' || expiryTime < 0) {
        return NextResponse.json({ success: false, error: 'Invalid expiryTime' }, { status: 400 });
      }
      updates.expiryTime = expiryTime;
    }
    if (dataLimitGB !== undefined) {
      if (typeof dataLimitGB !== 'number' || dataLimitGB < 0) {
        return NextResponse.json({ success: false, error: 'Invalid dataLimitGB' }, { status: 400 });
      }
      updates.dataLimitGB = dataLimitGB;
    }
    if (devices !== undefined) {
      if (typeof devices !== 'number' || devices < 1) {
        return NextResponse.json({ success: false, error: 'Invalid devices limit' }, { status: 400 });
      }
      updates.devices = devices;
    }
    if (status !== undefined) {
      if (status !== 'active' && status !== 'disabled' && status !== 'expired') {
        return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
      }
      updates.status = status;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No update values provided' }, { status: 400 });
    }

    const mongoose = await dbConnect();
    const db = mongoose.connection.getClient().db();
    const objectId = new mongoose.Types.ObjectId(id);
    const record = await db.collection('vpn_keys').findOne({ _id: objectId });

    if (!record) {
      return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
    }

    const panelReport = await mutateMultiServerKeyPanels(record, 'update', updates);
    log.info('Live 3xUI clients updated from WEB action', {
      recordId: id,
      updates,
      summary: panelReport.summary,
      webDbKeyFieldsChanged: false,
    });

    return NextResponse.json({
      success: true,
      message: `Updated live 3xUI clients: ${panelReport.summary.updated} updated, ${panelReport.summary.failed} failed. WEB key fields were not changed.`,
      data: { id, updates, panel: panelReport },
    });
  } catch (error) {
    log.error('Admin multi-server keys update error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Failed to update record' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing record id' }, { status: 400 });
    }

    const mongoose = await dbConnect();
    const db = mongoose.connection.getClient().db();
    const objectId = new mongoose.Types.ObjectId(id);
    
    // Fetch the record first to get all client links
    const record = await db.collection('vpn_keys').findOne({ _id: objectId });

    if (!record) {
      return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
    }

    const panelReport = await mutateMultiServerKeyPanels(record, 'delete');

    log.info('Live 3xUI clients deleted from WEB action', {
      recordId: id,
      summary: panelReport.summary,
      webDbKeyFieldsChanged: false,
    });

    return NextResponse.json({
      success: true,
      message: `Deleted live 3xUI clients: ${panelReport.summary.deleted} deleted, ${panelReport.summary.failed} failed. WEB record was kept for history/index.`,
      data: { id, panel: panelReport },
    });
  } catch (error) {
    log.error('Admin multi-server keys delete error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Failed to delete record' }, { status: 500 });
  }
}
