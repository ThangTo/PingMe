import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { getDirectKey, getOrCreateDirectConversation } from '../services/conversation.service.js';

dotenv.config();

const backfillConversations = async () => {
  await connectDB();

  const messages = await Message.find({
    $or: [{ conversation: { $exists: false } }, { conversation: null }],
    recipient: { $ne: null },
  })
    .select('_id sender recipient createdAt')
    .sort({ createdAt: 1 })
    .lean();

  const pairs = new Map();

  messages.forEach((message) => {
    const key = getDirectKey(message.sender, message.recipient);
    if (!pairs.has(key)) {
      pairs.set(key, { userA: message.sender, userB: message.recipient });
    }
  });

  for (const [directKey, pair] of pairs.entries()) {
    const conversation = await getOrCreateDirectConversation(pair.userA, pair.userB);

    await Message.updateMany(
      {
        $and: [
          { $or: [{ conversation: { $exists: false } }, { conversation: null }] },
          {
            $or: [
              { sender: pair.userA, recipient: pair.userB },
              { sender: pair.userB, recipient: pair.userA },
            ],
          },
        ],
      },
      { $set: { conversation: conversation._id } },
    );

    const lastMessage = await Message.findOne({ conversation: conversation._id })
      .sort({ createdAt: -1 })
      .select('_id')
      .lean();

    if (lastMessage) {
      await Conversation.updateOne(
        { _id: conversation._id },
        { $set: { lastMessage: lastMessage._id } },
      );
    }

    console.log(`Backfilled conversation ${conversation._id} for ${directKey}`);
  }

  console.log(`Done. Created or reused ${pairs.size} direct conversation(s).`);
  process.exit(0);
};

backfillConversations().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
