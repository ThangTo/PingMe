import mongoose from 'mongoose';

const queueJobSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true },
    encryptedPayload: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    availableAt: { type: Date, default: Date.now, index: true },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: '' },
    lastError: { type: String, default: '', maxlength: 1000 },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    completedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

queueJobSchema.index({ type: 1, status: 1, availableAt: 1, expiresAt: 1 });
queueJobSchema.index({ status: 1, lockedAt: 1 });
queueJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const QueueJob = mongoose.model('QueueJob', queueJobSchema);

export default QueueJob;
