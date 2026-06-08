import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';

dotenv.config();

const TEST_PASSWORD = '123456';

const createSeedPingId = (email) => email.split('@')[0].replace(/\./g, '_').toLowerCase();

const testUsers = [
  {
    username: 'Lan Anh',
    email: 'lan.anh.test@pingme.local',
    pingId: 'lan_anh_test',
    avatar:
      'https://ui-avatars.com/api/?name=Lan+Anh&background=d9c8b4&color=2a2520&bold=true',
    bio: 'Seed account for group chat testing',
    relationToRealAccounts: 'legacy',
  },
  {
    username: 'Minh Quan',
    email: 'minh.quan.test@pingme.local',
    pingId: 'minh_quan_test',
    avatar:
      'https://ui-avatars.com/api/?name=Minh+Quan&background=c7d6c2&color=2a2520&bold=true',
    bio: 'Seed account for group chat testing',
    relationToRealAccounts: 'legacy',
  },
  {
    username: 'Thu Ha',
    email: 'thu.ha.test@pingme.local',
    pingId: 'thu_ha_test',
    avatar:
      'https://ui-avatars.com/api/?name=Thu+Ha&background=d6c7c2&color=2a2520&bold=true',
    bio: 'Seed account for group chat testing',
    relationToRealAccounts: 'legacy',
  },
  {
    username: 'Hoang Nam',
    email: 'hoang.nam.test@pingme.local',
    pingId: 'hoang_nam_test',
    avatar:
      'https://ui-avatars.com/api/?name=Hoang+Nam&background=c8ced8&color=2a2520&bold=true',
    bio: 'Seed account for group chat testing',
    relationToRealAccounts: 'legacy',
  },
  {
    username: 'Bao Tran',
    email: 'bao.tran.test@pingme.local',
    pingId: 'bao_tran_test',
    avatar:
      'https://ui-avatars.com/api/?name=Bao+Tran&background=d9c8b4&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'friend',
  },
  {
    username: 'Ngoc Linh',
    email: 'ngoc.linh.test@pingme.local',
    pingId: 'ngoc_linh_test',
    avatar:
      'https://ui-avatars.com/api/?name=Ngoc+Linh&background=c7d6c2&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'friend',
  },
  {
    username: 'Quang Huy',
    email: 'quang.huy.test@pingme.local',
    pingId: 'quang_huy_test',
    avatar:
      'https://ui-avatars.com/api/?name=Quang+Huy&background=d6c7c2&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'friend',
  },
  {
    username: 'Mai Phuong',
    email: 'mai.phuong.test@pingme.local',
    pingId: 'mai_phuong_test',
    avatar:
      'https://ui-avatars.com/api/?name=Mai+Phuong&background=c8ced8&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'friend',
  },
  {
    username: 'Gia Han',
    email: 'gia.han.test@pingme.local',
    pingId: 'gia_han_test',
    avatar:
      'https://ui-avatars.com/api/?name=Gia+Han&background=e4d7c6&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'friend',
  },
  {
    username: 'Duc Anh',
    email: 'duc.anh.test@pingme.local',
    pingId: 'duc_anh_test',
    avatar:
      'https://ui-avatars.com/api/?name=Duc+Anh&background=ccd8d4&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'friend',
  },
  {
    username: 'Khanh Vy',
    email: 'khanh.vy.test@pingme.local',
    pingId: 'khanh_vy_test',
    avatar:
      'https://ui-avatars.com/api/?name=Khanh+Vy&background=d7c9da&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'friend',
  },
  {
    username: 'Nhat Minh',
    email: 'nhat.minh.test@pingme.local',
    pingId: 'nhat_minh_test',
    avatar:
      'https://ui-avatars.com/api/?name=Nhat+Minh&background=cfd8c6&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'friend',
  },
  {
    username: 'Thanh Tam',
    email: 'thanh.tam.test@pingme.local',
    pingId: 'thanh_tam_test',
    avatar:
      'https://ui-avatars.com/api/?name=Thanh+Tam&background=e0cfc5&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'friend',
  },
  {
    username: 'Phuong Thao',
    email: 'phuong.thao.test@pingme.local',
    pingId: 'phuong_thao_test',
    avatar:
      'https://ui-avatars.com/api/?name=Phuong+Thao&background=c4d4df&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'friend',
  },
  {
    username: 'Trung Kien',
    email: 'trung.kien.test@pingme.local',
    pingId: 'trung_kien_test',
    avatar:
      'https://ui-avatars.com/api/?name=Trung+Kien&background=dbcbb8&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'stranger',
  },
  {
    username: 'Hai Dang',
    email: 'hai.dang.test@pingme.local',
    pingId: 'hai_dang_test',
    avatar:
      'https://ui-avatars.com/api/?name=Hai+Dang&background=cbd7cc&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'stranger',
  },
  {
    username: 'Linh Chi',
    email: 'linh.chi.test@pingme.local',
    pingId: 'linh_chi_test',
    avatar:
      'https://ui-avatars.com/api/?name=Linh+Chi&background=d8c7cf&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'stranger',
  },
  {
    username: 'Tuan Kiet',
    email: 'tuan.kiet.test@pingme.local',
    pingId: 'tuan_kiet_test',
    avatar:
      'https://ui-avatars.com/api/?name=Tuan+Kiet&background=d7d1c2&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'stranger',
  },
  {
    username: 'An Nhien',
    email: 'an.nhien.test@pingme.local',
    pingId: 'an_nhien_test',
    avatar:
      'https://ui-avatars.com/api/?name=An+Nhien&background=c7d7d2&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'stranger',
  },
  {
    username: 'Viet Hoang',
    email: 'viet.hoang.test@pingme.local',
    pingId: 'viet_hoang_test',
    avatar:
      'https://ui-avatars.com/api/?name=Viet+Hoang&background=d8cfc7&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'stranger',
  },
  {
    username: 'My Duyen',
    email: 'my.duyen.test@pingme.local',
    pingId: 'my_duyen_test',
    avatar:
      'https://ui-avatars.com/api/?name=My+Duyen&background=d2c7d8&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'stranger',
  },
  {
    username: 'Quynh Nhu',
    email: 'quynh.nhu.test@pingme.local',
    pingId: 'quynh_nhu_test',
    avatar:
      'https://ui-avatars.com/api/?name=Quynh+Nhu&background=c8d3dd&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'stranger',
  },
  {
    username: 'Dang Khoa',
    email: 'dang.khoa.test@pingme.local',
    pingId: 'dang_khoa_test',
    avatar:
      'https://ui-avatars.com/api/?name=Dang+Khoa&background=d9d2c4&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'stranger',
  },
  {
    username: 'Bich Ngoc',
    email: 'bich.ngoc.test@pingme.local',
    pingId: 'bich_ngoc_test',
    avatar:
      'https://ui-avatars.com/api/?name=Bich+Ngoc&background=c9d8c9&color=2a2520&bold=true',
    bio: 'Seed account for contact and chat testing',
    relationToRealAccounts: 'stranger',
  },
];

const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';

const seedTestUsers = async () => {
  await connectDB();

  const managedSeedEmails = testUsers.map((user) => user.email);
  const realUsers = await User.find({
    email: { $not: /@pingme\.local$/ },
    username: { $not: /^E2E/i },
  })
    .select('_id email username')
    .lean();
  const realUserIds = realUsers.map((user) => user._id);
  const ignoredAutomationUsers = await User.find({
    $or: [
      { username: /^E2E/i },
      {
        $and: [
          { email: /@pingme\.local$/ },
          { email: { $nin: managedSeedEmails } },
        ],
      },
    ],
  })
    .select('_id email username')
    .lean();
  const ignoredAutomationUserIds = ignoredAutomationUsers.map((user) => user._id);
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
  const seedUsers = [];

  for (const seedUser of testUsers) {
    const user = await User.findOneAndUpdate(
      { email: seedUser.email },
      {
        $set: {
          username: seedUser.username,
          pingId: seedUser.pingId || createSeedPingId(seedUser.email),
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

  const seedUsersByEmail = new Map(seedUsers.map((user) => [user.email, user]));
  const getSeedIdsByRelation = (relations) => testUsers
    .filter((seedUser) => relations.includes(seedUser.relationToRealAccounts))
    .map((seedUser) => seedUsersByEmail.get(seedUser.email)?._id)
    .filter(Boolean);
  const friendSeedIds = getSeedIdsByRelation(['friend']);
  const strangerSeedIds = getSeedIdsByRelation(['stranger']);
  const nonFriendSeedIds = getSeedIdsByRelation(['legacy', 'stranger']);
  const legacySeedIds = getSeedIdsByRelation(['legacy']);

  if (realUserIds.length > 0 && friendSeedIds.length > 0) {
    await User.updateMany(
      { _id: { $in: realUserIds } },
      {
        $addToSet: { friends: { $each: friendSeedIds } },
        $pull: { friendRequests: { $in: friendSeedIds } },
      },
    );

    await User.updateMany(
      { _id: { $in: friendSeedIds } },
      {
        $addToSet: { friends: { $each: realUserIds } },
        $pull: { friendRequests: { $in: realUserIds } },
      },
    );
  }

  if (realUserIds.length > 0 && nonFriendSeedIds.length > 0) {
    await User.updateMany(
      { _id: { $in: realUserIds } },
      {
        $pull: {
          friends: { $in: nonFriendSeedIds },
          friendRequests: { $in: nonFriendSeedIds },
        },
      },
    );

    await User.updateMany(
      { _id: { $in: nonFriendSeedIds } },
      {
        $pull: {
          friends: { $in: realUserIds },
          friendRequests: { $in: realUserIds },
        },
      },
    );
  }

  if (friendSeedIds.length > 0 && strangerSeedIds.length > 0) {
    await User.updateMany(
      { _id: { $in: friendSeedIds } },
      {
        $addToSet: { friends: { $each: strangerSeedIds } },
        $pull: { friendRequests: { $in: strangerSeedIds } },
      },
    );

    await User.updateMany(
      { _id: { $in: strangerSeedIds } },
      {
        $addToSet: { friends: { $each: friendSeedIds } },
        $pull: { friendRequests: { $in: friendSeedIds } },
      },
    );
  }

  if (legacySeedIds.length > 0 && friendSeedIds.length > 0) {
    await User.updateMany(
      { _id: { $in: legacySeedIds } },
      {
        $pull: {
          friends: { $in: friendSeedIds },
          friendRequests: { $in: friendSeedIds },
        },
      },
    );

    await User.updateMany(
      { _id: { $in: friendSeedIds } },
      {
        $pull: {
          friends: { $in: legacySeedIds },
          friendRequests: { $in: legacySeedIds },
        },
      },
    );
  }

  if (ignoredAutomationUserIds.length > 0 && friendSeedIds.length > 0) {
    await User.updateMany(
      { _id: { $in: ignoredAutomationUserIds } },
      {
        $pull: {
          friends: { $in: friendSeedIds },
          friendRequests: { $in: friendSeedIds },
        },
      },
    );

    await User.updateMany(
      { _id: { $in: friendSeedIds } },
      {
        $pull: {
          friends: { $in: ignoredAutomationUserIds },
          friendRequests: { $in: ignoredAutomationUserIds },
        },
      },
    );
  }

  const refreshedSeedUsers = await User.find({ _id: { $in: seedUsers.map((user) => user._id) } })
    .select('username email friends')
    .lean();

  console.log('Seed users are ready:');
  refreshedSeedUsers.forEach((user) => {
    console.log(`- ${user.username} | ${user.email} | friends: ${user.friends.length}`);
  });
  console.log(`Password for all seed users: ${TEST_PASSWORD}`);
  console.log(`Legacy group-test accounts: ${getSeedIdsByRelation(['legacy']).length}`);
  console.log(`New friend accounts: ${getSeedIdsByRelation(['friend']).length}`);
  console.log(`New stranger accounts: ${strangerSeedIds.length}`);
  console.log(`Linked friend accounts with ${realUsers.length} real account(s), removed stranger links.`);
  console.log('Linked new friend accounts with new stranger accounts for friend-of-friend suggestions.');
  console.log(`Ignored automation account(s): ${ignoredAutomationUsers.length}`);

  await mongoose.disconnect();
  process.exit(0);
};

seedTestUsers().catch(async (error) => {
  console.error('Seed test users failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
