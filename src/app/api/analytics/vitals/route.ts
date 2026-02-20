import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/analytics/vitals' });

// ==========================================
// Web Vitals Collection Endpoint
// POST /api/analytics/vitals — receive batched web vitals
// GET  /api/analytics/vitals — admin: read aggregated vitals
// ==========================================

// Mongoose schema for vitals (auto-created collection)
const VitalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true }, // LCP, FID, CLS, FCP, TTFB, INP
    value: { type: Number, required: true },
    rating: { type: String, enum: ['good', 'needs-improvement', 'poor'] },
    delta: Number,
    metricId: String,
    navigationType: String,
    url: { type: String, index: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// TTL: auto-delete after 90 days
VitalSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
// Compound index for aggregation queries
VitalSchema.index({ name: 1, timestamp: -1 });

const Vital = mongoose.models.Vital || mongoose.model('Vital', VitalSchema);

// POST — receive web vitals batch
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vitals } = body;

    if (!Array.isArray(vitals) || vitals.length === 0) {
      return NextResponse.json({ success: false, error: 'No vitals provided' }, { status: 400 });
    }

    // Cap at 50 vitals per request
    const batch = vitals.slice(0, 50);

    await connectDB();

    const docs = batch.map((v: Record<string, unknown>) => ({
      name: String(v.name || ''),
      value: Number(v.value || 0),
      rating: String(v.rating || 'good'),
      delta: Number(v.delta || 0),
      metricId: String(v.id || ''),
      navigationType: String(v.navigationType || ''),
      url: String(v.url || ''),
      timestamp: v.timestamp ? new Date(v.timestamp as number) : new Date(),
    }));

    await Vital.insertMany(docs, { ordered: false });

    return NextResponse.json({ success: true, count: docs.length });
  } catch (error: unknown) {
    log.error('Vitals POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: true, count: 0 }); // Don't fail client
  }
}

// GET — admin: aggregated vitals summary
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '7'), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Aggregate p50, p75, p95 for each metric
    const aggregation = await Vital.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: '$name',
          count: { $sum: 1 },
          avg: { $avg: '$value' },
          min: { $min: '$value' },
          max: { $max: '$value' },
          values: { $push: '$value' },
          goodCount: { $sum: { $cond: [{ $eq: ['$rating', 'good'] }, 1, 0] } },
          needsImprovementCount: { $sum: { $cond: [{ $eq: ['$rating', 'needs-improvement'] }, 1, 0] } },
          poorCount: { $sum: { $cond: [{ $eq: ['$rating', 'poor'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Calculate percentiles
    const metrics = aggregation.map((m) => {
      const sorted = m.values.sort((a: number, b: number) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
      const p75 = sorted[Math.floor(sorted.length * 0.75)] || 0;
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;

      return {
        name: m._id,
        count: m.count,
        avg: Math.round(m.avg),
        min: Math.round(m.min),
        max: Math.round(m.max),
        p50: Math.round(p50),
        p75: Math.round(p75),
        p95: Math.round(p95),
        good: m.goodCount,
        needsImprovement: m.needsImprovementCount,
        poor: m.poorCount,
        goodPct: m.count > 0 ? Math.round((m.goodCount / m.count) * 100) : 0,
      };
    });

    // Daily trend (per metric per day)
    const dailyTrend = await Vital.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            name: '$name',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          },
          avg: { $avg: '$value' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    // Top slow pages
    const slowPages = await Vital.aggregate([
      { $match: { timestamp: { $gte: since }, name: 'LCP' } },
      {
        $group: {
          _id: '$url',
          avgLCP: { $avg: '$value' },
          count: { $sum: 1 },
        },
      },
      { $sort: { avgLCP: -1 } },
      { $limit: 10 },
    ]);

    return NextResponse.json({
      success: true,
      data: {
        period: `${days}d`,
        metrics,
        dailyTrend: dailyTrend.map((d) => ({
          name: d._id.name,
          date: d._id.date,
          avg: Math.round(d.avg),
          count: d.count,
        })),
        slowPages: slowPages.map((p) => ({
          url: p._id,
          avgLCP: Math.round(p.avgLCP),
          visits: p.count,
        })),
      },
    });
  } catch (error: unknown) {
    log.error('Vitals GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
