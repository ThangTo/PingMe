import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import { getDirectKey, getOrCreateDirectConversation, toIdString } from '../services/conversation.service.js';

dotenv.config();

const isApplyMode = process.argv.includes('--apply');

const backfillDirectConversations = async () => {
  await connectDB();

  const users = await User.find({ friends: { $exists: true, $ne: [] } })
    .select('_id friends')
    .lean();

  const pairs = new Map();

  users.forEach((user) => {
    const userId = toIdString(user._id);
    (user.friends || []).forEach((friendId) => {
      const friendIdString = toIdString(friendId);
      if (!friendIdString || friendIdString === userId) return;
      const directKey = getDirectKey(userId, friendIdString);
      if (!pairs.has(directKey)) {
        pairs.set(directKey, { userA: userId, userB: friendIdString });
      }
    });
  });

  const directKeys = [...pairs.keys()];
  const existing = await Conversation.find({ directKey: { $in: directKeys } })
    .select('directKey')
    .lean();
  const existingKeys = new Set(existing.map((conversation) => conversation.directKey));
  const missingPairs = [...pairs.entries()].filter(([directKey]) => !existingKeys.has(directKey));

  console.log(`[PingMe] Friend pairs: ${pairs.size}`);
  console.log(`[PingMe] Existing direct conversations: ${existingKeys.size}`);
  console.log(`[PingMe] Missing direct conversations: ${missingPairs.length}`);

  if (!isApplyMode) {
    console.log('[PingMe] Dry run only. Re-run with --apply to create missing conversations.');
    await mongoose.disconnect();
    return;
  }

  for (const [directKey, pair] of missingPairs) {
    const conversation = await getOrCreateDirectConversation(pair.userA, pair.userB);
    console.log(`[PingMe] Created/reused ${conversation._id} for ${directKey}`);
  }

  await mongoose.disconnect();
};

backfillDirectConversations().catch(async (error) => {
  console.error('[PingMe] Backfill direct conversations failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
