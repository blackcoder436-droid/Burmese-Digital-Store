import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRotateDoToken {
  id: string;
  label: string;
  token: string;
  enabled?: boolean;
}

export interface IRotateCfAccount {
  id: string;
  label: string;
  token: string;
  email?: string;
  enabled?: boolean;
}

export interface IRotateServerLink {
  id: string;
  serverName: string;
  tokenId: string;
  enabled?: boolean;
}

export interface IRotateConfigDocument extends Document {
  doToken1: string; // Token for Account 1 (jan, sg1, sg4)
  doToken2: string; // Token for Account 2 (sg2, sg3, backup)
  doToken3?: string; // Optional Token for Account 3
  doToken4?: string; // Optional Token for Account 4
  doTokens?: IRotateDoToken[];
  serverLinks?: IRotateServerLink[];
  cfAccounts?: IRotateCfAccount[];
  cfToken: string;  // Cloudflare API Token
  cfEmail: string;  // Cloudflare Email (e.g. blackcoder436@gmail.com)
  xuiUsername: string; // e.g. Blackcoder
  xuiPassword: string; // e.g. Mka@2016
  enable2FA: boolean;  // CLI Option for 2FA (y/n)
  dropletRegion: string; // e.g. sgp1
  dropletSize: string; // e.g. s-1vcpu-1gb
  dropletImage: string; // e.g. ubuntu-22-04-x64
  dropletBackups: boolean;
  dropletIpv6: boolean;
  dropletMonitoring: boolean;
  dropletPublicNetworking: boolean;
  dropletAgent: boolean;
  dropletSshKeys?: string;
  dropletTags?: string;
  dropletVpcUuid?: string;
  dropletVolumes?: string;
  dropletUserData?: string;
  dropletBackupPolicy?: string;
  tgBotToken?: string; // Telegram Bot Token for sending backup
  tgChatId?: string;   // Telegram Chat ID to send backup to
  updatedAt: Date;
}

const RotateConfigSchema: Schema = new Schema(
  {
    doToken1: { type: String, default: '' },
    doToken2: { type: String, default: '' },
    doToken3: { type: String, default: '' },
    doToken4: { type: String, default: '' },
    doTokens: {
      type: [
        {
          id: { type: String, default: '' },
          label: { type: String, default: '' },
          token: { type: String, default: '' },
          enabled: { type: Boolean, default: true },
        },
      ],
      default: [],
    },
    serverLinks: {
      type: [
        {
          id: { type: String, default: '' },
          serverName: { type: String, default: '' },
          tokenId: { type: String, default: '' },
          enabled: { type: Boolean, default: true },
        },
      ],
      default: [],
    },
    cfAccounts: {
      type: [
        {
          id: { type: String, default: '' },
          label: { type: String, default: '' },
          token: { type: String, default: '' },
          email: { type: String, default: '' },
          enabled: { type: Boolean, default: true },
        },
      ],
      default: [],
    },
    cfToken: { type: String, default: '' },
    cfEmail: { type: String, default: 'blackcoder436@gmail.com' },
    xuiUsername: { type: String, default: 'Blackcoder' },
    xuiPassword: { type: String, default: 'Mka@2016' },
    enable2FA: { type: Boolean, default: false },
    dropletRegion: { type: String, default: 'sgp1' },
    dropletSize: { type: String, default: 's-1vcpu-1gb' },
    dropletImage: { type: String, default: 'ubuntu-22-04-x64' },
    dropletBackups: { type: Boolean, default: false },
    dropletIpv6: { type: Boolean, default: false },
    dropletMonitoring: { type: Boolean, default: true },
    dropletPublicNetworking: { type: Boolean, default: true },
    dropletAgent: { type: Boolean, default: true },
    dropletSshKeys: { type: String, default: '' },
    dropletTags: { type: String, default: '' },
    dropletVpcUuid: { type: String, default: '' },
    dropletVolumes: { type: String, default: '' },
    dropletUserData: { type: String, default: '' },
    dropletBackupPolicy: { type: String, default: '' },
    tgBotToken: { type: String, default: '' },
    tgChatId: { type: String, default: '' },
  },
  { timestamps: true }
);

// We only need one configuration document (Singleton pattern)
export const RotateConfig: Model<IRotateConfigDocument> =
  mongoose.models.RotateConfig ||
  mongoose.model<IRotateConfigDocument>('RotateConfig', RotateConfigSchema);

export async function getRotateConfig(): Promise<IRotateConfigDocument> {
  let doc = await RotateConfig.findOne();
  if (!doc) {
    doc = await RotateConfig.create({});
  }
  return doc;
}
