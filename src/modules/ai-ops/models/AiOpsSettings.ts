import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IAiOpsSettingsDocument extends Document {
  key: 'default';
  enabled: boolean;
  customerSystemPrompt: string;
  responseStyle: string;
  fallbackReply: string;
  paymentAttachmentReply: string;
  escalationReply: string;
  maxKnowledgeItems: number;
  allowCustomerOrderLookup: boolean;
  allowAiOrderActions: boolean;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_CUSTOMER_SYSTEM_PROMPT =
  'Customer တွေနဲ့ စကားပြောတဲ့အခါ စာအရှည်ကြီးမဖြေပါနဲ့။ လိုတိုရှင်း၊ လူတစ်ယောက်ပြောနေသလို၊ အရောင်းအကူတစ်ယောက်လို နူးညံ့ပြီး သေချာဖြေပါ။ မသေချာတဲ့အချက်ကို မထွင်ပါနဲ့။ Payment/order/refund/VPN key delivery ကိစ္စတွေမှာ admin manual verification လိုအပ်ကြောင်း ပြောပါ။';

const DEFAULT_RESPONSE_STYLE =
  'Reply length: 1-5 short lines. Use customer language. Ask one follow-up question when needed. Use emoji sparingly. Give exact next step.';

const DEFAULT_FALLBACK_REPLY =
  'ခဏလောက် technical issue ဖြစ်နေပါတယ်။ Telegram Bot @BurmeseDigitalStore_bot ကနေ ဆက်သွယ်ပေးပါ။ Admin က စစ်ပေးပါမယ်။';

const DEFAULT_PAYMENT_ATTACHMENT_REPLY =
  'ဓာတ်ပုံ/ဖိုင် ရလာပါတယ်။ Payment slip ဖြစ်ရင် admin က manual စစ်ပြီးမှ order ကို approve လုပ်ပေးပါမယ်။ Order/payment အတွက် website မှာ screenshot upload လုပ်ထားရင် ပိုမြန်ပါတယ်။';

const DEFAULT_ESCALATION_REPLY =
  'ဒီကိစ္စကို admin ကိုယ်တိုင်စစ်ပေးပါမယ်။ Order number/အသုံးပြုတဲ့ account info လေးပို့ပေးပါ။';

const AiOpsSettingsSchema = new Schema<IAiOpsSettingsDocument>(
  {
    key: {
      type: String,
      enum: ['default'],
      default: 'default',
      unique: true,
      required: true,
    },
    enabled: { type: Boolean, default: true },
    customerSystemPrompt: {
      type: String,
      default: DEFAULT_CUSTOMER_SYSTEM_PROMPT,
      maxlength: 12000,
    },
    responseStyle: {
      type: String,
      default: DEFAULT_RESPONSE_STYLE,
      maxlength: 4000,
    },
    fallbackReply: {
      type: String,
      default: DEFAULT_FALLBACK_REPLY,
      maxlength: 2000,
    },
    paymentAttachmentReply: {
      type: String,
      default: DEFAULT_PAYMENT_ATTACHMENT_REPLY,
      maxlength: 2000,
    },
    escalationReply: {
      type: String,
      default: DEFAULT_ESCALATION_REPLY,
      maxlength: 2000,
    },
    maxKnowledgeItems: {
      type: Number,
      default: 8,
      min: 0,
      max: 20,
    },
    allowCustomerOrderLookup: { type: Boolean, default: true },
    allowAiOrderActions: { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const AiOpsSettings: Model<IAiOpsSettingsDocument> =
  mongoose.models.AiOpsSettings ||
  mongoose.model<IAiOpsSettingsDocument>('AiOpsSettings', AiOpsSettingsSchema);

export default AiOpsSettings;
