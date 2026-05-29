import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type AiKnowledgeCategory =
  | 'pricing'
  | 'service'
  | 'setup'
  | 'troubleshooting'
  | 'payment'
  | 'policy'
  | 'faq'
  | 'announcement'
  | 'other';

export type AiOpsChannel = 'website' | 'telegram' | 'facebook' | 'all';

export interface IAiKnowledgeItemDocument extends Document {
  title: string;
  category: AiKnowledgeCategory;
  content: string;
  tags: string[];
  channels: AiOpsChannel[];
  enabled: boolean;
  priority: number;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AiKnowledgeItemSchema = new Schema<IAiKnowledgeItemDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      enum: [
        'pricing',
        'service',
        'setup',
        'troubleshooting',
        'payment',
        'policy',
        'faq',
        'announcement',
        'other',
      ],
      default: 'faq',
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 16000,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
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
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

AiKnowledgeItemSchema.index({ enabled: 1, priority: -1, updatedAt: -1 });
AiKnowledgeItemSchema.index({ title: 'text', content: 'text', tags: 'text' });

const AiKnowledgeItem: Model<IAiKnowledgeItemDocument> =
  mongoose.models.AiKnowledgeItem ||
  mongoose.model<IAiKnowledgeItemDocument>('AiKnowledgeItem', AiKnowledgeItemSchema);

export default AiKnowledgeItem;
