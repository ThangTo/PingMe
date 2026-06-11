import mongoose from 'mongoose';

const conversationDraftSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    content: {
      type: String,
      default: '',
      maxlength: [5000, 'Draft cannot exceed 5000 characters'],
    },
  },
  { timestamps: true },
);

conversationDraftSchema.index({ user: 1, conversation: 1 }, { unique: true });
conversationDraftSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.model('ConversationDraft', conversationDraftSchema);
