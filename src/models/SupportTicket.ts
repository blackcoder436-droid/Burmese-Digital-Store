import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// Support Ticket Model - Burmese Digital Store
// ==========================================

export interface ITicketMessage {
  sender: mongoose.Types.ObjectId;
  senderRole: 'user' | 'admin';
  content: string;
  createdAt: Date;
}

export interface ISupportTicketDocument extends Document {
  ticketNumber: string; // ST-000001
  user: mongoose.Types.ObjectId;
  subject: string;
  category: 'order' | 'payment' | 'vpn' | 'account' | 'other';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  messages: ITicketMessage[];
  relatedOrder?: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  closedAt?: Date;
  closedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TicketMessageSchema: Schema = new Schema({
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderRole: {
    type: String,
    enum: ['user', 'admin'],
    required: true,
  },
  content: {
    type: String,
    required: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters'],
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const SupportTicketSchema: Schema = new Schema(
  {
    ticketNumber: {
      type: String,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['order', 'payment', 'vpn', 'account', 'other'],
        message: '{VALUE} is not a valid category',
      },
    },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'resolved', 'closed'],
      default: 'open',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    messages: [TicketMessageSchema],
    relatedOrder: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    closedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate ticketNumber before save
SupportTicketSchema.pre('save', async function (next) {
  if (!this.ticketNumber) {
    try {
      const lastTicket = await mongoose.models.SupportTicket
        .findOne({ ticketNumber: { $exists: true, $ne: null } })
        .sort({ ticketNumber: -1 })
        .select('ticketNumber')
        .lean() as { ticketNumber?: string } | null;

      let nextNum = 1;
      if (lastTicket?.ticketNumber) {
        const match = lastTicket.ticketNumber.match(/ST-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      this.ticketNumber = `ST-${String(nextNum).padStart(6, '0')}`;
    } catch {
      this.ticketNumber = `ST-${Date.now().toString(36).toUpperCase()}`;
    }
  }
  next();
});

// Indexes
SupportTicketSchema.index({ ticketNumber: 1 }, { unique: true, sparse: true });
SupportTicketSchema.index({ user: 1, status: 1 });
SupportTicketSchema.index({ status: 1, createdAt: -1 });
SupportTicketSchema.index({ assignedTo: 1, status: 1 });
SupportTicketSchema.index({ priority: 1, status: 1 });

const SupportTicket: Model<ISupportTicketDocument> =
  mongoose.models.SupportTicket || mongoose.model<ISupportTicketDocument>('SupportTicket', SupportTicketSchema);

export default SupportTicket;
