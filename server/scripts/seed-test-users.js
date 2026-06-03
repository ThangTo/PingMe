import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';

dotenv.config();

const TEST_PASSWORD = '123456';

const testUsers = [
  {
    username: 'Lan Anh',
    email: 'lan.anh.test@pingme.local',
    avatar:
      'https://ui-avatars.com/api/?name=Lan+Anh&background=d9c8b4&color=2a2520&bold=true',
    bio: 'Seed account for group chat testing',
  },
  {
    username: 'Minh Quan',
    email: 'minh.quan.test@pingme.local',
    avatar:
      'https://ui-avatars.com/api/?name=Minh+Quan&background=c7d6c2&color=2a2520&bold=true',
    bio: 'Seed account for group chat testing',
  },
  {
    username: 'Thu Ha',
    email: 'thu.ha.test@pingme.local',
    avatar:
      'https://ui-avatars.com/api/?name=Thu+Ha&background=d6c7c2&color=2a2520&bold=true',
    bio: 'Seed account for group chat testing',
  },
  {
    username: 'Hoang Nam',
    email: 'hoang.nam.test@pingme.local',
    avatar:
      'https://ui-avatars.com/api/?name=Hoang+Nam&background=c8ced8&color=2a2520&bold=true',
    bio: 'Seed account for group chat testing',
  },
];

const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';

const seedTestUsers = async () => {
  await connectDB();

  const existingUsersBeforeSeed = await User.find({}).select('_id email username').lean();
  const existingUserIds = existingUsersBeforeSeed.map((user) => user._id);
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
  const seedUsers = [];

  for (const seedUser of testUsers) {
    const user = await User.findOneAndUpdate(
      { email: seedUser.email },
      {
        $set: {
          username: seedUser.username,
          password: hashedPassword,
          provider: 'local',
          avatar: seedUser.avatar,
          bio: seedUser.bio,
          isOnline: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    seedUsers.push(user);
  }

  const seedUserIds = seedUsers.map((user) => user._id);
  const allTargetUsers = await User.find({
    _id: { $in: [...existingUserIds, ...seedUserIds] },
  }).select('_id friends friendRequests username email');

  for (const targetUser of allTargetUsers) {
    const targetId = toIdString(targetUser);
    const shouldLinkSeedUsers = seedUserIds.filter((id) => toIdString(id) !== targetId);
    const shouldLinkExistingUsers = seedUserIds.some((id) => toIdString(id) === targetId)
      ? existingUserIds.filter((id) => toIdString(id) !== targetId)
      : [];
    const friendIds = [...shouldLinkSeedUsers, ...shouldLinkExistingUsers];

    if (friendIds.length === 0) continue;

    await User.updateOne(
      { _id: targetUser._id },
      {
        $addToSet: { friends: { $each: friendIds } },
        $pull: { friendRequests: { $in: friendIds } },
      },
    );
  }

  const refreshedSeedUsers = await User.find({ _id: { $in: seedUserIds } })
    .select('username email friends')
    .lean();

  console.log('Seed users are ready:');
  refreshedSeedUsers.forEach((user) => {
    console.log(`- ${user.username} | ${user.email} | friends: ${user.friends.length}`);
  });
  console.log(`Password for all seed users: ${TEST_PASSWORD}`);
  console.log(`Linked seed users with ${existingUsersBeforeSeed.length} existing account(s).`);

  await mongoose.disconnect();
  process.exit(0);
};

seedTestUsers().catch(async (error) => {
  console.error('Seed test users failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
