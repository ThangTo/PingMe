import mongoose from 'mongoose';

const callSessionSchema = new mongoose.Schema(
  {
    callId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    callee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['voice', 'video'],
      required: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['ringing', 'connected', 'ended', 'missed', 'rejected', 'cancelled', 'busy', 'failed'],
      default: 'ringing',
      index: true,
    },
    ringExpiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

callSessionSchema.index({ callee: 1, status: 1, ringExpiresAt: -1 });
callSessionSchema.index({ caller: 1, status: 1, ringExpiresAt: -1 });
callSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const CallSession = mongoose.model('CallSession', callSessionSchema);

export default CallSession;
