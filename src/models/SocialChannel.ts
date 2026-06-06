import mongoose, { Schema, Document, Model } from 'mongoose';

export type SocialPlatform = 'facebook' | 'telegram';

export interface ISocialChannelDocument extends Document {
  channelId: string;
  label: string;
  platform: SocialPlatform;
  enabled: boolean;
  facebook?: {
    pageId?: string;
    pageAccessToken?: string;
    pageUrl?: string;
  };
  telegram?: {
    botToken?: string;
    chatId?: string;
    channelUrl?: string;
  };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SocialChannelSchema = new Schema(
  {
    channelId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_-]+$/,
    },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    platform: {
      type: String,
      enum: ['facebook', 'telegram'],
      required: true,
      index: true,
    },
    enabled: { type: Boolean, default: true, index: true },
    facebook: {
      pageId: { type: String, trim: true, default: '' },
      pageAccessToken: { type: String, default: '' },
      pageUrl: { type: String, trim: true, default: '' },
    },
    telegram: {
      botToken: { type: String, default: '' },
      chatId: { type: String, trim: true, default: '' },
      channelUrl: { type: String, trim: true, default: '' },
    },
    notes: { type: String, trim: true, maxlength: 600, default: '' },
  },
  { timestamps: true }
);

SocialChannelSchema.index({ label: 1 });

const SocialChannel: Model<ISocialChannelDocument> =
  mongoose.models.SocialChannel ||
  mongoose.model<ISocialChannelDocument>('SocialChannel', SocialChannelSchema);

export default SocialChannel;
