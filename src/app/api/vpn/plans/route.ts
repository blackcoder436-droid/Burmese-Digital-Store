import { NextResponse } from 'next/server';
import { VPN_PLANS, getDeviceCounts, getPlansForDevices } from '@/lib/vpn-plans';

// GET /api/vpn/plans - Public VPN plan list
export async function GET() {
  const deviceCounts = getDeviceCounts();
  const plansByDevice: Record<number, typeof VPN_PLANS[string][]> = {};

  for (const d of deviceCounts) {
    plansByDevice[d] = getPlansForDevices(d);
  }

  return NextResponse.json({
    success: true,
    data: { plans: Object.values(VPN_PLANS), plansByDevice, deviceCounts },
  });
}
