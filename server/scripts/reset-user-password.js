import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Session from '../models/Session.js';
import User from '../models/User.js';

dotenv.config();

const getArgValue = (name, fallback = '') => {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
};

const shouldReset = process.argv.includes('--reset');
const shouldRevoke = process.argv.includes('--revoke');
const lookup = getArgValue('--user', getArgValue('--email', getArgValue('--ping-id', 'Thắng Tô')));
const newPassword = getArgValue('--password', '123456');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildQuery = (value) => {
  const normalized = value.trim();
  const normalizedPingId = normalized.replace(/^@+/, '').toLowerCase();
  const exactInsensitive = new RegExp(`^${escapeRegex(normalized)}$`, 'i');
  return {
    $or: [
      { email: normalized.toLowerCase() },
      { pingId: normalizedPingId },
      { username: exactInsensitive },
    ],
  };
};

const main = async () => {
  await connectDB();

  const user = await User.findOne(buildQuery(lookup)).select('+password provider email username pingId isOnline lastSeen');
  if (!user) {
    console.error(`Khong tim thay user: ${lookup}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const activeSessionCount = await Session.countDocuments({
    user: user._id,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  console.log(
    JSON.stringify(
      {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        pingId: user.pingId,
        provider: user.provider,
        hasPassword: Boolean(user.password),
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        activeSessionCount,
      },
      null,
      2,
    ),
  );

  if (shouldReset) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Mat khau moi phai co it nhat 6 ky tu');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.provider = 'local';
    await user.save();

    let revokedCount = 0;
    if (shouldRevoke) {
      const result = await Session.updateMany(
        { user: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
      revokedCount = result.modifiedCount;
    }

    console.log(
      JSON.stringify(
        {
          reset: true,
          password: newPassword,
          revokedSessions: revokedCount,
        },
        null,
        2,
      ),
    );
  } else {
    console.log('Chua reset password. Them --reset de dat mat khau moi.');
  }

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('Reset user password failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
