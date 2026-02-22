import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// VPN Server Model - Burmese Digital Store
// Dynamic 3xUI server configuration (admin-managed)
// ==========================================

export interface IVpnServerDocument extends Document {
  serverId: string; // unique slug: sg1, us1, jp1, etc.
  name: string; // display name: Singapore 1, United States, etc.
  flag: string; // emoji flag: 🇸🇬, 🇺🇸, etc.
  url: string; // panel base URL: https://jan.burmesedigital.store:8080
  panelPath: string; // panel path: /mka
  domain: string; // connection domain: jan.burmesedigital.store
  subPort: number; // subscription port: 2096
  trojanPort?: number; // @deprecated — use protocolPorts.trojan instead
  protocolPorts?: { trojan?: number; vless?: number; vmess?: number; shadowsocks?: number };
  protocol: string; // default protocol: trojan, vless, vmess
  enabledProtocols: string[]; // available protocols: ['trojan', 'vless', 'vmess', 'shadowsocks']
  enabled: boolean; // admin toggle (disabled = hidden from users, no provisioning)
  online: boolean; // runtime status (health check result)
  notes?: string; // admin-only notes
  createdAt: Date;
  updatedAt: Date;
}

const VpnServerSchema: Schema = new Schema(
  {
    serverId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_-]+$/,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    flag: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    panelPath: {
      type: String,
      required: true,
      trim: true,
      default: '/mka',
    },
    domain: {
      type: String,
      required: true,
      trim: true,
    },
    subPort: {
      type: Number,
      required: true,
      default: 2096,
    },
    trojanPort: {
      type: Number,
      default: null,
    },
    protocolPorts: {
      type: {
        trojan: { type: Number, default: null },
        vless: { type: Number, default: null },
        vmess: { type: Number, default: null },
        shadowsocks: { type: Number, default: null },
      },
      default: {},
    },
    protocol: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: 'trojan',
      enum: ['trojan', 'vless', 'vmess'],
    },
    enabledProtocols: {
      type: [String],
      default: ['trojan', 'vless', 'vmess', 'shadowsocks'],
      validate: {
        validator: (arr: string[]) =>
          arr.every((p) => ['trojan', 'vless', 'vmess', 'shadowsocks'].includes(p)),
        message: 'Invalid protocol in enabledProtocols',
      },
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    online: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
VpnServerSchema.index({ enabled: 1 });
VpnServerSchema.index({ protocol: 1 });

const VpnServer: Model<IVpnServerDocument> =
  mongoose.models.VpnServer ||
  mongoose.model<IVpnServerDocument>('VpnServer', VpnServerSchema);

export default VpnServer;
