import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { AiOpsChannel } from './AiKnowledgeItem';

export type AiBotLogSource =
  | 'ai'
  | 'faq'
  | 'fixed'
  | 'knowledge'
  | 'command'
  | 'error'
  | 'system';

export type AiBotLogDirection = 'inbound' | 'outbound' | 'action' | 'error';

export interface IAiBotLogDocument extends Document {
  channel: AiOpsChannel;
  direction: AiBotLogDirection;
  source: AiBotLogSource;
  status: 'success' | 'failed' | 'skipped';
  sessionId?: string;
  externalUserId?: string;
  user?: mongoose.Types.ObjectId;
  messagePreview?: string;
  replyPreview?: string;
  aiModel?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AiBotLogSchema = new Schema<IAiBotLogDocument>(
  {
    channel: {
      type: String,
      enum: ['website', 'telegram', 'facebook', 'all'],
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound', 'action', 'error'],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['ai', 'faq', 'fixed', 'knowledge', 'command', 'error', 'system'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'skipped'],
      default: 'success',
      index: true,
    },
    sessionId: { type: String, maxlength: 160, index: true },
    externalUserId: { type: String, maxlength: 200, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    messagePreview: { type: String, maxlength: 1000 },
    replyPreview: { type: String, maxlength: 1000 },
    aiModel: { type: String, maxlength: 100 },
    durationMs: { type: Number, min: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

AiBotLogSchema.index({ createdAt: -1 });
AiBotLogSchema.index({ channel: 1, createdAt: -1 });
AiBotLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AiBotLog: Model<IAiBotLogDocument> =
  mongoose.models.AiBotLog ||
  mongoose.model<IAiBotLogDocument>('AiBotLog', AiBotLogSchema);

export default AiBotLog;
