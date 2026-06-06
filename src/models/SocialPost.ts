import mongoose, { Schema, Document, Model } from 'mongoose';

export type SocialPostStatus = 'draft' | 'publishing' | 'published' | 'partial_failed' | 'failed';
export type SocialPostContentType = 'text' | 'link' | 'image';
export type SocialPostResultStatus = 'success' | 'error';

export interface ISocialPostResult {
  channelId: string;
  channelLabel: string;
  platform: 'facebook' | 'telegram';
  status: SocialPostResultStatus;
  externalPostId?: string;
  externalUrl?: string;
  error?: string;
  publishedAt?: Date;
}

export interface ISocialPostDocument extends Document {
  postId: string;
  title: string;
  message: string;
  linkUrl?: string;
  imageUrl?: string;
  contentType: SocialPostContentType;
  targetChannelIds: string[];
  status: SocialPostStatus;
  results: ISocialPostResult[];
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SocialPostResultSchema = new Schema(
  {
    channelId: { type: String, trim: true, required: true },
    channelLabel: { type: String, trim: true, default: '' },
    platform: { type: String, enum: ['facebook', 'telegram'], required: true },
    status: { type: String, enum: ['success', 'error'], required: true },
    externalPostId: { type: String, trim: true, default: '' },
    externalUrl: { type: String, trim: true, default: '' },
    error: { type: String, trim: true, default: '' },
    publishedAt: { type: Date },
  },
  { _id: false }
);

const SocialPostSchema = new Schema(
  {
    postId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_-]+$/,
    },
    title: { type: String, trim: true, maxlength: 160, default: '' },
    message: { type: String, trim: true, maxlength: 6000, default: '' },
    linkUrl: { type: String, trim: true, default: '' },
    imageUrl: { type: String, trim: true, default: '' },
    contentType: {
      type: String,
      enum: ['text', 'link', 'image'],
      default: 'text',
      index: true,
    },
    targetChannelIds: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['draft', 'publishing', 'published', 'partial_failed', 'failed'],
      default: 'draft',
      index: true,
    },
    results: { type: [SocialPostResultSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

SocialPostSchema.index({ createdAt: -1 });
SocialPostSchema.index({ status: 1, updatedAt: -1 });

const SocialPost: Model<ISocialPostDocument> =
  mongoose.models.SocialPost ||
  mongoose.model<ISocialPostDocument>('SocialPost', SocialPostSchema);

export default SocialPost;
