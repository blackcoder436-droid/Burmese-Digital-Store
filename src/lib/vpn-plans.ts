// ==========================================
// VPN Plan Configuration - Burmese Digital Store
// ==========================================
// Real plans matching vpn bot config.py

export interface VpnPlan {
  id: string;
  name: string;
  devices: number;
  months: number;
  expiryDays: number;
  dataLimitGB: number; // 0 = unlimited
  price: number; // MMK
}

// Paid plans: 1-5 devices × 1/3/5/7/9/12 months
// Generate plans from a monthly base price to keep web and bot prices in sync.
const MONTHLY_BASE: Record<number, number> = {
  1: 4000,
  2: 7000,
  3: 10000,
  4: 13000,
  5: 16000,
};

const MONTH_OPTIONS = [1, 3, 5, 7, 9, 12];

export const VPN_PLANS: Record<string, VpnPlan> = (() => {
  const out: Record<string, VpnPlan> = {};
  for (const devices of [1, 2, 3, 4, 5]) {
    const monthly = MONTHLY_BASE[devices];
    for (const months of MONTH_OPTIONS) {
      const id = `${devices}dev_${months}month`;
      const name = `${devices} Device${devices > 1 ? 's' : ''} - ${months} Month${months > 1 ? 's' : ''}`;
      const expiryDays = months === 12 ? 365 : months * 30;
      const price = monthly * months;
      out[id] = {
        id,
        name,
        devices,
        months,
        expiryDays,
        dataLimitGB: 0,
        price,
      };
    }
  }
  return out;
})();

export function getPlan(planId: string): VpnPlan | undefined {
  return VPN_PLANS[planId];
}

export function isValidPlanId(planId: string): boolean {
  return planId in VPN_PLANS;
}

/**
 * Build a plan ID from devices + months selection
 */
export function buildPlanId(devices: number, months: number): string {
  return `${devices}dev_${months}month`;
}

/**
 * Get all plans for a given device count
 */
export function getPlansForDevices(devices: number): VpnPlan[] {
  return Object.values(VPN_PLANS).filter((p) => p.devices === devices);
}

/**
 * Get all unique device counts
 */
export function getDeviceCounts(): number[] {
  return [1, 2, 3, 4, 5];
}
