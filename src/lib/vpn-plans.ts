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
// Prices are defined explicitly to match the website pricing table (discounts applied).
const MONTH_OPTIONS = [1, 3, 5, 7, 9, 12];

const PRICE_TABLE: Record<number, Record<number, number>> = {
  1: { 1: 4000, 3: 11000, 5: 18000, 7: 25000, 9: 31000, 12: 38000 },
  2: { 1: 7000, 3: 20000, 5: 32000, 7: 43000, 9: 54000, 12: 67000 },
  3: { 1: 10000, 3: 29000, 5: 46000, 7: 62000, 9: 77000, 12: 96000 },
  4: { 1: 13000, 3: 37000, 5: 60000, 7: 80000, 9: 99000, 12: 125000 },
  5: { 1: 16000, 3: 46000, 5: 74000, 7: 99000, 9: 122000, 12: 154000 },
};

export const VPN_PLANS: Record<string, VpnPlan> = (() => {
  const out: Record<string, VpnPlan> = {};
  for (const devices of [1, 2, 3, 4, 5]) {
    for (const months of MONTH_OPTIONS) {
      const id = `${devices}dev_${months}month`;
      const name = `${devices} Device${devices > 1 ? 's' : ''} - ${months} Month${months > 1 ? 's' : ''}`;
      const expiryDays = months === 12 ? 365 : months * 30;
      const price = PRICE_TABLE[devices]?.[months] ?? 0;
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
