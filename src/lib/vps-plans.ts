export type VpsPlan = {
  id: string;
  name: string;
  os: string;
  price: number;
  specs: { label: string; value: string }[];
  highlight?: boolean;
};

export const vpsPlans: VpsPlan[] = [
  {
    id: 'ubuntu-micro',
    name: 'Cloud VPS - Ubuntu Micro',
    os: 'Ubuntu 22.04',
    price: 50000,
    specs: [
      { label: 'CPU', value: '1 vCPU Intel' },
      { label: 'RAM', value: '2 GB DDR4' },
      { label: 'Storage', value: '50 GB SSD' },
      { label: 'Traffic', value: '2 TB / month' },
      { label: 'Locations', value: 'Singapore, US' },
    ],
  },
  {
    id: 'ubuntu-starter',
    name: 'Cloud VPS - Ubuntu Starter',
    os: 'Ubuntu 22.04',
    price: 70000,
    specs: [
      { label: 'CPU', value: '2 vCPU Intel' },
      { label: 'RAM', value: '2 GB DDR4' },
      { label: 'Storage', value: '60 GB SSD' },
      { label: 'Traffic', value: '3 TB / month' },
      { label: 'Locations', value: 'Singapore, US' },
    ],
  },
  {
    id: 'ubuntu-pro',
    name: 'Cloud VPS - Ubuntu Pro',
    os: 'Ubuntu 22.04',
    price: 100000,
    specs: [
      { label: 'CPU', value: '2 vCPU Intel' },
      { label: 'RAM', value: '4 GB DDR4' },
      { label: 'Storage', value: '80 GB SSD' },
      { label: 'Traffic', value: '4 TB / month' },
      { label: 'Locations', value: 'Singapore, US' },
    ],
  },
  {
    id: 'ubuntu-premium',
    name: 'Cloud VPS - Ubuntu Premium',
    os: 'Ubuntu 22.04',
    price: 130000,
    specs: [
      { label: 'CPU', value: '4 vCPU Intel' },
      { label: 'RAM', value: '8 GB DDR4' },
      { label: 'Storage', value: '160 GB SSD' },
      { label: 'Traffic', value: '5 TB / month' },
      { label: 'Locations', value: 'Singapore, US' },
    ],
  },
];

export function getVpsPlan(id: string): VpsPlan | undefined {
  return vpsPlans.find((p) => p.id === id);
}
