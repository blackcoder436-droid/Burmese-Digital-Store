import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRotateJobDocument extends Document {
  jobId: string;
  action: string;
  serverId: string;
  status: 'running' | 'success' | 'error';
  message: string;
  result?: Record<string, any>;
  error?: string;
  startedAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

const RotateJobSchema: Schema = new Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    action: { type: String, required: true, index: true },
    serverId: { type: String, required: true, index: true },
    status: { type: String, enum: ['running', 'success', 'error'], required: true, index: true },
    message: { type: String, default: '' },
    result: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: '' },
    startedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: false }
);

const RotateJob: Model<IRotateJobDocument> =
  mongoose.models.RotateJob ||
  mongoose.model<IRotateJobDocument>('RotateJob', RotateJobSchema);

export default RotateJob;
