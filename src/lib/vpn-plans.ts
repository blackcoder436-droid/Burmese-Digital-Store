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
export const VPN_PLANS: Record<string, VpnPlan> = {
  // 1 Device
  '1dev_1month':  { id: '1dev_1month',  name: '1 Device - 1 Month',   devices: 1, months: 1,  expiryDays: 30,  dataLimitGB: 0, price: 3000  },
  '1dev_3month':  { id: '1dev_3month',  name: '1 Device - 3 Months',  devices: 1, months: 3,  expiryDays: 90,  dataLimitGB: 0, price: 8000  },
  '1dev_5month':  { id: '1dev_5month',  name: '1 Device - 5 Months',  devices: 1, months: 5,  expiryDays: 150, dataLimitGB: 0, price: 13000 },
  '1dev_7month':  { id: '1dev_7month',  name: '1 Device - 7 Months',  devices: 1, months: 7,  expiryDays: 210, dataLimitGB: 0, price: 18000 },
  '1dev_9month':  { id: '1dev_9month',  name: '1 Device - 9 Months',  devices: 1, months: 9,  expiryDays: 270, dataLimitGB: 0, price: 23000 },
  '1dev_12month': { id: '1dev_12month', name: '1 Device - 12 Months', devices: 1, months: 12, expiryDays: 365, dataLimitGB: 0, price: 30000 },
  // 2 Devices
  '2dev_1month':  { id: '2dev_1month',  name: '2 Devices - 1 Month',   devices: 2, months: 1,  expiryDays: 30,  dataLimitGB: 0, price: 4000  },
  '2dev_3month':  { id: '2dev_3month',  name: '2 Devices - 3 Months',  devices: 2, months: 3,  expiryDays: 90,  dataLimitGB: 0, price: 10000 },
  '2dev_5month':  { id: '2dev_5month',  name: '2 Devices - 5 Months',  devices: 2, months: 5,  expiryDays: 150, dataLimitGB: 0, price: 17000 },
  '2dev_7month':  { id: '2dev_7month',  name: '2 Devices - 7 Months',  devices: 2, months: 7,  expiryDays: 210, dataLimitGB: 0, price: 24000 },
  '2dev_9month':  { id: '2dev_9month',  name: '2 Devices - 9 Months',  devices: 2, months: 9,  expiryDays: 270, dataLimitGB: 0, price: 30000 },
  '2dev_12month': { id: '2dev_12month', name: '2 Devices - 12 Months', devices: 2, months: 12, expiryDays: 365, dataLimitGB: 0, price: 40000 },
  // 3 Devices
  '3dev_1month':  { id: '3dev_1month',  name: '3 Devices - 1 Month',   devices: 3, months: 1,  expiryDays: 30,  dataLimitGB: 0, price: 5000  },
  '3dev_3month':  { id: '3dev_3month',  name: '3 Devices - 3 Months',  devices: 3, months: 3,  expiryDays: 90,  dataLimitGB: 0, price: 13000 },
  '3dev_5month':  { id: '3dev_5month',  name: '3 Devices - 5 Months',  devices: 3, months: 5,  expiryDays: 150, dataLimitGB: 0, price: 21000 },
  '3dev_7month':  { id: '3dev_7month',  name: '3 Devices - 7 Months',  devices: 3, months: 7,  expiryDays: 210, dataLimitGB: 0, price: 29000 },
  '3dev_9month':  { id: '3dev_9month',  name: '3 Devices - 9 Months',  devices: 3, months: 9,  expiryDays: 270, dataLimitGB: 0, price: 37000 },
  '3dev_12month': { id: '3dev_12month', name: '3 Devices - 12 Months', devices: 3, months: 12, expiryDays: 365, dataLimitGB: 0, price: 50000 },
  // 4 Devices
  '4dev_1month':  { id: '4dev_1month',  name: '4 Devices - 1 Month',   devices: 4, months: 1,  expiryDays: 30,  dataLimitGB: 0, price: 6000  },
  '4dev_3month':  { id: '4dev_3month',  name: '4 Devices - 3 Months',  devices: 4, months: 3,  expiryDays: 90,  dataLimitGB: 0, price: 16000 },
  '4dev_5month':  { id: '4dev_5month',  name: '4 Devices - 5 Months',  devices: 4, months: 5,  expiryDays: 150, dataLimitGB: 0, price: 25000 },
  '4dev_7month':  { id: '4dev_7month',  name: '4 Devices - 7 Months',  devices: 4, months: 7,  expiryDays: 210, dataLimitGB: 0, price: 35000 },
  '4dev_9month':  { id: '4dev_9month',  name: '4 Devices - 9 Months',  devices: 4, months: 9,  expiryDays: 270, dataLimitGB: 0, price: 45000 },
  '4dev_12month': { id: '4dev_12month', name: '4 Devices - 12 Months', devices: 4, months: 12, expiryDays: 365, dataLimitGB: 0, price: 60000 },
  // 5 Devices
  '5dev_1month':  { id: '5dev_1month',  name: '5 Devices - 1 Month',   devices: 5, months: 1,  expiryDays: 30,  dataLimitGB: 0, price: 7000  },
  '5dev_3month':  { id: '5dev_3month',  name: '5 Devices - 3 Months',  devices: 5, months: 3,  expiryDays: 90,  dataLimitGB: 0, price: 18000 },
  '5dev_5month':  { id: '5dev_5month',  name: '5 Devices - 5 Months',  devices: 5, months: 5,  expiryDays: 150, dataLimitGB: 0, price: 30000 },
  '5dev_7month':  { id: '5dev_7month',  name: '5 Devices - 7 Months',  devices: 5, months: 7,  expiryDays: 210, dataLimitGB: 0, price: 40000 },
  '5dev_9month':  { id: '5dev_9month',  name: '5 Devices - 9 Months',  devices: 5, months: 9,  expiryDays: 270, dataLimitGB: 0, price: 52000 },
  '5dev_12month': { id: '5dev_12month', name: '5 Devices - 12 Months', devices: 5, months: 12, expiryDays: 365, dataLimitGB: 0, price: 70000 },
};

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
