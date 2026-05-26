import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRotateConfigDocument extends Document {
  doToken1: string; // Token for Account 1 (jan, sg1, sg4)
  doToken2: string; // Token for Account 2 (sg2, sg3, backup)
  cfToken: string;  // Cloudflare API Token
  cfEmail: string;  // Cloudflare Email (e.g. blackcoder436@gmail.com)
  xuiUsername: string; // e.g. Blackcoder
  xuiPassword: string; // e.g. Mka@2016
  enable2FA: boolean;  // CLI Option for 2FA (y/n)
  dropletSize: string; // e.g. s-1vcpu-1gb
  dropletImage: string; // e.g. ubuntu-22-04-x64
  tgBotToken?: string; // Telegram Bot Token for sending backup
  tgChatId?: string;   // Telegram Chat ID to send backup to
  updatedAt: Date;
}

const RotateConfigSchema: Schema = new Schema(
  {
    doToken1: { type: String, default: '' },
    doToken2: { type: String, default: '' },
    cfToken: { type: String, default: '' },
    cfEmail: { type: String, default: 'blackcoder436@gmail.com' },
    xuiUsername: { type: String, default: 'Blackcoder' },
    xuiPassword: { type: String, default: 'Mka@2016' },
    enable2FA: { type: Boolean, default: false },
    dropletSize: { type: String, default: 's-1vcpu-1gb' },
    dropletImage: { type: String, default: 'ubuntu-22-04-x64' },
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
