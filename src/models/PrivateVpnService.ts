import mongoose, { Schema, Document, Model } from 'mongoose';

export type PrivateVpnCustomerType = 'family' | 'company' | 'internal';
export type PrivateVpnStatus = 'planned' | 'provisioning' | 'active' | 'suspended' | 'rotating' | 'archived' | 'error';
export type PrivateVpnActionMode = 'create_new' | 'attach_existing' | 'replace_existing';

export interface IPrivateVpnServiceDocument extends Document {
  serviceId: string;
  customerName: string;
  customerType: PrivateVpnCustomerType;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  status: PrivateVpnStatus;
  actionMode: PrivateVpnActionMode;
  linkedServerId?: string;
  domain: {
    cfAccountId?: string;
    zoneId?: string;
    zoneName?: string;
    hostname: string;
    recordType: 'A';
    content?: string;
    proxied: boolean;
    ttl: number;
    dnsRecordId?: string;
  };
  droplet: {
    provider: 'digitalocean';
    tokenId?: string;
    dropletLimit: number;
    dropletId?: string;
    dropletName: string;
    publicIp?: string;
    region: string;
    size: string;
    image: string;
    backups: boolean;
    ipv6: boolean;
    monitoring: boolean;
    publicNetworking: boolean;
    dropletAgent: boolean;
    sshKeys: string[];
    vpcUuid?: string;
    volumes: string[];
    tags: string[];
    userData?: string;
    existingDropletId?: string;
    replaceOldDroplet: boolean;
  };
  panel: {
    username: string;
    password: string;
    enable2FA: boolean;
    panelPath: string;
    panelPort: number;
    subPort: number;
    protocolPorts: {
      vless: number;
      trojan: number;
      vmess: number;
      shadowsocks: number;
    };
    ufwAllowPorts: number[];
    installStatus: 'pending' | 'installed' | 'repair_needed' | 'unknown';
  };
  createdAt: Date;
  updatedAt: Date;
}

const PrivateVpnServiceSchema = new Schema(
  {
    serviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_-]+$/,
    },
    customerName: { type: String, required: true, trim: true, maxlength: 160 },
    customerType: {
      type: String,
      enum: ['family', 'company', 'internal'],
      default: 'family',
      index: true,
    },
    contactName: { type: String, trim: true, maxlength: 120, default: '' },
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 160, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    status: {
      type: String,
      enum: ['planned', 'provisioning', 'active', 'suspended', 'rotating', 'archived', 'error'],
      default: 'planned',
      index: true,
    },
    actionMode: {
      type: String,
      enum: ['create_new', 'attach_existing', 'replace_existing'],
      default: 'create_new',
      index: true,
    },
    linkedServerId: { type: String, trim: true, lowercase: true, default: '', index: true },
    domain: {
      cfAccountId: { type: String, trim: true, default: '' },
      zoneId: { type: String, trim: true, default: '' },
      zoneName: { type: String, trim: true, lowercase: true, default: '' },
      hostname: { type: String, required: true, trim: true, lowercase: true, index: true },
      recordType: { type: String, enum: ['A'], default: 'A' },
      content: { type: String, trim: true, default: '' },
      proxied: { type: Boolean, default: false },
      ttl: { type: Number, default: 60 },
      dnsRecordId: { type: String, trim: true, default: '' },
    },
    droplet: {
      provider: { type: String, enum: ['digitalocean'], default: 'digitalocean' },
      tokenId: { type: String, trim: true, default: '' },
      dropletLimit: { type: Number, default: 3, min: 1, max: 100 },
      dropletId: { type: String, trim: true, default: '' },
      dropletName: { type: String, required: true, trim: true, lowercase: true },
      publicIp: { type: String, trim: true, default: '' },
      region: { type: String, trim: true, default: 'sgp1' },
      size: { type: String, trim: true, default: 's-1vcpu-1gb' },
      image: { type: String, trim: true, default: 'ubuntu-22-04-x64' },
      backups: { type: Boolean, default: false },
      ipv6: { type: Boolean, default: false },
      monitoring: { type: Boolean, default: true },
      publicNetworking: { type: Boolean, default: true },
      dropletAgent: { type: Boolean, default: true },
      sshKeys: { type: [String], default: [] },
      vpcUuid: { type: String, trim: true, default: '' },
      volumes: { type: [String], default: [] },
      tags: { type: [String], default: ['private-vpn'] },
      userData: { type: String, default: '' },
      existingDropletId: { type: String, trim: true, default: '' },
      replaceOldDroplet: { type: Boolean, default: false },
    },
    panel: {
      username: { type: String, trim: true, default: 'admin' },
      password: { type: String, default: '' },
      enable2FA: { type: Boolean, default: false },
      panelPath: { type: String, trim: true, default: '/mka' },
      panelPort: { type: Number, default: 2053 },
      subPort: { type: Number, default: 2096 },
      protocolPorts: {
        vless: { type: Number, default: 443 },
        trojan: { type: Number, default: 2083 },
        vmess: { type: Number, default: 2087 },
        shadowsocks: { type: Number, default: 8443 },
      },
      ufwAllowPorts: { type: [Number], default: [443, 8443, 2053, 2083, 2087, 2096] },
      installStatus: {
        type: String,
        enum: ['pending', 'installed', 'repair_needed', 'unknown'],
        default: 'pending',
      },
    },
  },
  { timestamps: true }
);

PrivateVpnServiceSchema.index({ customerName: 1 });
PrivateVpnServiceSchema.index({ 'droplet.dropletName': 1 });

const PrivateVpnService: Model<IPrivateVpnServiceDocument> =
  mongoose.models.PrivateVpnService ||
  mongoose.model<IPrivateVpnServiceDocument>('PrivateVpnService', PrivateVpnServiceSchema);

export default PrivateVpnService;
