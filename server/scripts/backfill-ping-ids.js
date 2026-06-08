import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';

dotenv.config();

const RESERVED_IDS_BY_EMAIL = new Map([
  ['tothang141020@gmail.com', 'thangto'],
  ['tominhthang952@gmail.com', 'tester1'],
  ['tothang141020+test2@gmail.com', 'tester2'],
]);

const normalizeVietnamese = (value = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

const toPingIdBase = (value = '') => {
  const normalized = normalizeVietnamese(value)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  const withLetterPrefix = /^[a-z]/.test(normalized) ? normalized : `u_${normalized}`;
  return withLetterPrefix.padEnd(5, '0').slice(0, 28);
};

const makeUniquePingId = (base, usedIds) => {
  let candidate = base;
  let suffix = 1;

  while (usedIds.has(candidate)) {
    const suffixText = `_${suffix}`;
    candidate = `${base.slice(0, 32 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
};

const backfillPingIds = async () => {
  await connectDB();

  const users = await User.find({}).select('_id username email pingId').sort({ createdAt: 1 });
  const usedPingIds = new Set(
    users
      .map((user) => user.pingId)
      .filter(Boolean)
      .map((pingId) => pingId.toLowerCase()),
  );
  let updatedCount = 0;

  for (const user of users) {
    if (user.pingId) continue;

    const reservedId = RESERVED_IDS_BY_EMAIL.get(user.email);
    const base = reservedId || toPingIdBase(user.username || user.email.split('@')[0]);
    const pingId = makeUniquePingId(base, usedPingIds);

    await User.updateOne({ _id: user._id }, { $set: { pingId } });
    updatedCount += 1;
    console.log(`Set ${user.email} -> ${pingId}`);
  }

  console.log(`Backfilled PingMe ID for ${updatedCount} user(s).`);
  await mongoose.disconnect();
  process.exit(0);
};

backfillPingIds().catch(async (error) => {
  console.error('Backfill PingMe IDs failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
