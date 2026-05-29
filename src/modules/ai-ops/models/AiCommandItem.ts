import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { AiOpsChannel } from './AiKnowledgeItem';

export type AiCommandItemType = 'notice' | 'rule' | 'promotion' | 'maintenance' | 'escalation';

export interface IAiCommandItemDocument extends Document {
  title: string;
  type: AiCommandItemType;
  content: string;
  channels: AiOpsChannel[];
  enabled: boolean;
  priority: number;
  startsAt?: Date;
  endsAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AiCommandItemSchema = new Schema<IAiCommandItemDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    type: {
      type: String,
      enum: ['notice', 'rule', 'promotion', 'maintenance', 'escalation'],
      default: 'notice',
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8000,
    },
    channels: {
      type: [String],
      enum: ['website', 'telegram', 'facebook', 'all'],
      default: ['all'],
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    startsAt: Date,
    endsAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

AiCommandItemSchema.index({ enabled: 1, priority: -1, updatedAt: -1 });
AiCommandItemSchema.index({ startsAt: 1, endsAt: 1 });

const AiCommandItem: Model<IAiCommandItemDocument> =
  mongoose.models.AiCommandItem ||
  mongoose.model<IAiCommandItemDocument>('AiCommandItem', AiCommandItemSchema);

export default AiCommandItem;
