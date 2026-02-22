import mongoose, { Schema, type Document } from 'mongoose';

// ==========================================
// AI Chat Session Model - Burmese Digital Store
// Stores conversation history for AI assistant
// ==========================================

export interface IAiChatMessageDoc {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface IAiChatSessionDocument extends Document {
  user?: mongoose.Types.ObjectId;
  sessionId: string;
  messages: IAiChatMessageDoc[];
  context: 'customer' | 'admin';
  metadata?: {
    userAgent?: string;
    page?: string;
  };
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AiChatMessageSchema = new Schema<IAiChatMessageDoc>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: { type: String, required: true, maxlength: 4000 },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AiChatSessionSchema = new Schema<IAiChatSessionDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    messages: {
      type: [AiChatMessageSchema],
      default: [],
      validate: {
        validator: (v: IAiChatMessageDoc[]) => v.length <= 100,
        message: 'Chat session cannot exceed 100 messages',
      },
    },
    context: {
      type: String,
      enum: ['customer', 'admin'],
      default: 'customer',
    },
    metadata: {
      userAgent: { type: String, maxlength: 500 },
      page: { type: String, maxlength: 200 },
    },
    closedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Auto-expire old sessions after 30 days
AiChatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.models.AiChatSession ||
  mongoose.model<IAiChatSessionDocument>('AiChatSession', AiChatSessionSchema);
