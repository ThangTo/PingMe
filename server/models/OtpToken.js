import mongoose from 'mongoose';

const otpTokenSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    purpose: {
      type: String,
      required: true,
      enum: ['register', 'password_reset'],
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
      select: false,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    emailDeliveryStatus: {
      type: String,
      enum: ['queued', 'sent', 'failed'],
      default: 'queued',
    },
    emailSentAt: {
      type: Date,
      default: null,
    },
    emailDeliveryError: {
      type: String,
      default: '',
      maxlength: 1000,
    },
  },
  { timestamps: true },
);

otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpTokenSchema.index({ email: 1, purpose: 1, consumedAt: 1, expiresAt: -1 });

const OtpToken = mongoose.model('OtpToken', otpTokenSchema);

export default OtpToken;
