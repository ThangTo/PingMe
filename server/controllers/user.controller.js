import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { getUserRoomId } from '../services/conversation.service.js';
import { createNotification } from '../services/notification.service.js';
import {
  PRIVACY_VISIBILITY_VALUES,
  canViewOnlineStatus,
  getVisibleAvatar,
  getVisibleOnlineStatus,
  normalizePrivacySettings,
} from '../services/privacy.service.js';

const emitToUser = (req, userId, eventName, payload) => {
  req.app.get('io')?.to(getUserRoomId(userId)).emit(eventName, payload);
};

const getMessageAttachments = (message) => {
  if (!message || message.isDeleted) return [];
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return message.attachments;
  }
  return message.attachment ? [message.attachment] : [];
};

const getMessagePreview = (message) => {
  if (!message) return 'Bắt đầu trò chuyện';
  if (message.isDeleted) return 'Tin nhắn này đã được thu hồi';
  const attachments = getMessageAttachments(message);

  if (message.content) return message.content;
  if (attachments.length === 0) return 'Tin nhắn mới';
  if (attachments.length === 1 && attachments[0].type === 'audio') return 'Tin nhắn thoại';
  if (attachments.length === 1) return attachments[0].filename || 'Tệp đính kèm';
  if (attachments.every((attachment) => attachment.type === 'image')) return `${attachments.length} ảnh`;
  if (attachments.every((attachment) => attachment.type === 'audio')) {
    return `${attachments.length} tin nhắn thoại`;
  }
  return `${attachments.length} tệp đính kèm`;
};

const formatUserProfile = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  avatar: user.avatar,
  bio: user.bio || '',
  provider: user.provider,
  notificationSettings: {
    muteAll: Boolean(user.notificationSettings?.muteAll),
  },
  privacySettings: normalizePrivacySettings(user.privacySettings),
  createdAt: user.createdAt,
});

const PROFILE_SELECT = 'username email avatar bio provider notificationSettings privacySettings createdAt';

const getUploadedFileUrl = (req, file) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${file.filename}`;
};

const deleteUploadedFile = async (file) => {
  if (!file?.path) return;
  try {
    await fs.unlink(file.path);
  } catch (error) {
    console.warn('Khong the xoa file upload tam:', error.message || error);
  }
};

const formatVisibleUser = (user, viewerId) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  avatar: getVisibleAvatar(viewerId, user),
  isOnline: getVisibleOnlineStatus(viewerId, user),
});

const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';

const hasObjectId = (ids = [], targetId) =>
  ids.some((id) => toIdString(id) === toIdString(targetId));

const getMutualFriendInfo = (currentUser, targetUser) => {
  const currentFriendById = new Map(
    (currentUser.friends || []).map((friend) => [toIdString(friend), friend]),
  );
  const mutualFriendIds = (targetUser.friends || [])
    .map(toIdString)
    .filter((friendId) => currentFriendById.has(friendId));

  return {
    mutualFriendCount: mutualFriendIds.length,
    mutualFriends: mutualFriendIds.slice(0, 3).map((friendId) => {
      const friend = currentFriendById.get(friendId);
      return {
        _id: friend._id,
        username: friend.username,
        avatar: friend.avatar,
      };
    }),
  };
};

const getRelationshipStatus = (currentUser, targetUser, currentUserId) => {
  if (hasObjectId(currentUser.friends, targetUser._id)) return 'friend';
  if (hasObjectId(targetUser.friendRequests, currentUserId)) return 'sent';
  if (hasObjectId(currentUser.friendRequests, targetUser._id)) return 'received';
  return 'none';
};

const formatDiscoverableUser = (user, currentUser, viewerId) => ({
  ...formatVisibleUser(user, viewerId),
  status: getRelationshipStatus(currentUser, user, viewerId),
  ...getMutualFriendInfo(currentUser, user),
});

const emitPresenceForPrivacyChange = (req, user) => {
  const io = req.app.get('io');
  if (!io) return;

  (user.friends || []).forEach((friendId) => {
    const canView = canViewOnlineStatus(friendId, user);
    io.to(getUserRoomId(friendId)).emit('user_status_changed', {
      userId: user._id.toString(),
      status: canView && user.isOnline ? 'online' : 'offline',
    });
  });
};

const userController = {
  // Lấy profile hiện tại
  getMe: async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select(PROFILE_SELECT);

      if (!user) {
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

      res.status(200).json({
        success: true,
        user: formatUserProfile(user),
      });
    } catch (error) {
      console.error('Lỗi lấy profile:', error);
      res.status(500).json({ error: 'Không thể lấy profile' });
    }
  },

  // Cập nhật profile cơ bản
  updateProfile: async (req, res) => {
    try {
      const { username, avatar, bio } = req.body;
      const updates = {};

      if (username !== undefined) {
        const trimmedUsername = username.trim();
        if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
          return res.status(400).json({ error: 'Tên hiển thị phải từ 3 đến 30 ký tự' });
        }
        updates.username = trimmedUsername;
      }

      if (avatar !== undefined) {
        const trimmedAvatar = avatar.trim();
        if (trimmedAvatar && !/^https?:\/\//i.test(trimmedAvatar)) {
          return res.status(400).json({ error: 'Avatar phải là URL hợp lệ' });
        }
        updates.avatar = trimmedAvatar || 'https://via.placeholder.com/150';
      }

      if (bio !== undefined) {
        const trimmedBio = bio.trim();
        if (trimmedBio.length > 160) {
          return res.status(400).json({ error: 'Bio tối đa 160 ký tự' });
        }
        updates.bio = trimmedBio;
      }

      const user = await User.findByIdAndUpdate(req.user.id, updates, {
        new: true,
        runValidators: true,
      }).select(PROFILE_SELECT);

      if (!user) {
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

      res.status(200).json({
        success: true,
        user: formatUserProfile(user),
      });
    } catch (error) {
      console.error('Lỗi cập nhật profile:', error);
      res.status(500).json({ error: 'Không thể cập nhật profile' });
    }
  },

  // Đổi mật khẩu cho tài khoản local
  uploadAvatar: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Vui lòng chọn ảnh avatar' });
      }

      const mimeType = req.file.mimetype.split(';')[0].trim().toLowerCase();
      if (!mimeType.startsWith('image/')) {
        await deleteUploadedFile(req.file);
        return res.status(400).json({ error: 'Avatar phải là file ảnh' });
      }

      if (req.file.size > 5 * 1024 * 1024) {
        await deleteUploadedFile(req.file);
        return res.status(400).json({ error: 'Avatar tối đa 5MB' });
      }

      const user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: { avatar: getUploadedFileUrl(req, req.file) } },
        { new: true, runValidators: true },
      ).select(PROFILE_SELECT);

      if (!user) {
        await deleteUploadedFile(req.file);
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

      res.status(200).json({
        success: true,
        user: formatUserProfile(user),
      });
    } catch (error) {
      await deleteUploadedFile(req.file);
      console.error('Lỗi upload avatar:', error);
      res.status(500).json({ error: 'Không thể upload avatar' });
    }
  },

  updatePrivacySettings: async (req, res) => {
    try {
      const { onlineVisibility, avatarVisibility } = req.body;
      const updates = {};

      if (onlineVisibility !== undefined) {
        if (!PRIVACY_VISIBILITY_VALUES.includes(onlineVisibility)) {
          return res.status(400).json({ error: 'onlineVisibility không hợp lệ' });
        }
        updates['privacySettings.onlineVisibility'] = onlineVisibility;
      }

      if (avatarVisibility !== undefined) {
        if (!PRIVACY_VISIBILITY_VALUES.includes(avatarVisibility)) {
          return res.status(400).json({ error: 'avatarVisibility không hợp lệ' });
        }
        updates['privacySettings.avatarVisibility'] = avatarVisibility;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Không có thiết lập riêng tư để cập nhật' });
      }

      const user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: updates },
        { new: true, runValidators: true },
      ).select(`${PROFILE_SELECT} friends isOnline`);

      if (!user) {
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

      emitPresenceForPrivacyChange(req, user);

      res.status(200).json({
        success: true,
        user: formatUserProfile(user),
      });
    } catch (error) {
      console.error('Lỗi cập nhật riêng tư:', error);
      res.status(500).json({ error: 'Không thể cập nhật thiết lập riêng tư' });
    }
  },

  updateNotificationSettings: async (req, res) => {
    try {
      const { muteAll } = req.body;

      if (typeof muteAll !== 'boolean') {
        return res.status(400).json({ error: 'muteAll phải là boolean' });
      }

      const user = await User.findByIdAndUpdate(
        req.user.id,
        {
          $set: {
            'notificationSettings.muteAll': muteAll,
          },
        },
        { new: true, runValidators: true },
      ).select(PROFILE_SELECT);

      if (!user) {
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

      res.status(200).json({
        success: true,
        user: formatUserProfile(user),
      });
    } catch (error) {
      console.error('Lỗi cập nhật thông báo:', error);
      res.status(500).json({ error: 'Không thể cập nhật thông báo' });
    }
  },

  changePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Vui lòng nhập đủ mật khẩu hiện tại và mật khẩu mới' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
      }

      const user = await User.findById(req.user.id).select('+password provider');
      if (!user) {
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

      if (user.provider !== 'local' || !user.password) {
        return res.status(400).json({ error: 'Tài khoản này không dùng mật khẩu local' });
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      res.status(200).json({ success: true, message: 'Đã đổi mật khẩu' });
    } catch (error) {
      console.error('Lỗi đổi mật khẩu:', error);
      res.status(500).json({ error: 'Không thể đổi mật khẩu' });
    }
  },

  //Lấy toàn bộ user
  getAllUsers: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const currentUser = await User.findById(currentUserId)
        .populate('friends', 'username avatar')
        .select('friends friendRequests blockedUsers')
        .lean();

      if (!currentUser) {
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

      const blockedUserIds = currentUser.blockedUsers || [];
      const usersWhoBlockedCurrent = await User.find({ blockedUsers: currentUserId }).distinct('_id');
      // Lấy tất cả user có thể hiển thị để dựng màn kết nối mới.
      const users = await User.find({
        _id: {
          $ne: currentUserId,
          $nin: [...blockedUserIds, ...usersWhoBlockedCurrent],
        },
      }).select('username email avatar isOnline friendRequests friends privacySettings');

      res.status(200).json({
        success: true,
        users: users.map((user) => formatDiscoverableUser(user, currentUser, currentUserId)),
      });
    } catch (error) {
      res.status(500).json({ error: 'Không thể lấy danh sách người dùng' });
    }
  },

  //Lấy danh sách bạn bè
  getFriends: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const user = await User.findById(currentUserId)
        .populate('friends', 'username email avatar isOnline friends privacySettings')
        .lean();

      if (!user) {
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

      const friendObjectIds = user.friends.map((friend) => friend._id);
      const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);

      const lastMessages = await Message.aggregate([
        {
          $match: {
            $or: [
              { sender: currentUserObjectId, recipient: { $in: friendObjectIds } },
              { sender: { $in: friendObjectIds }, recipient: currentUserObjectId },
            ],
          },
        },
        {
          $addFields: {
            friendId: {
              $cond: [{ $eq: ['$sender', currentUserObjectId] }, '$recipient', '$sender'],
            },
          },
        },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$friendId', message: { $first: '$$ROOT' } } },
      ]);

      const lastMessageByFriend = new Map(
        lastMessages.map((item) => [item._id.toString(), item.message]),
      );

      const unreadCounts = await Message.aggregate([
        {
          $match: {
            isDeleted: false,
            recipient: user._id,
            sender: { $in: friendObjectIds },
            status: { $ne: 'read' },
          },
        },
        { $group: { _id: '$sender', count: { $sum: 1 } } },
      ]);

      const unreadCountByFriend = new Map(
        unreadCounts.map((item) => [item._id.toString(), item.count]),
      );

      const friends = user.friends
        .map((friend) => {
          const friendId = friend._id.toString();
          const lastMessage = lastMessageByFriend.get(friendId);

          return {
            _id: friend._id,
            username: friend.username,
            email: friend.email,
            avatar: getVisibleAvatar(currentUserId, friend),
            isOnline: getVisibleOnlineStatus(currentUserId, friend),
            lastMessage: getMessagePreview(lastMessage),
            lastMessageAt: lastMessage?.createdAt || null,
            unreadCount: unreadCountByFriend.get(friendId) || 0,
          };
        })
        .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

      res.status(200).json({ success: true, friends });
    } catch (error) {
      console.error('Lỗi lấy danh sách bạn bè:', error);
      res.status(500).json({ error: 'Không thể lấy danh sách bạn bè' });
    }
  },

  //Lấy danh sách lời mời kết bạn
  getFriendRequests: async (req, res) => {
    try {
      const user = await User.findById(req.user.id).populate(
        'friendRequests',
        'username email avatar isOnline friends privacySettings',
      );
      res.status(200).json({
        success: true,
        requests: user.friendRequests.map((requester) => formatVisibleUser(requester, req.user.id)),
      });
    } catch (error) {
      res.status(500).json({ error: 'Không thể lấy danh sách lời mời' });
    }
  },

  // Tìm kiếm user
  searchUsers: async (req, res) => {
    try {
      const query = (req.query.query || req.query.q || '').trim();

      if (query.length < 2) {
        return res.status(200).json({ success: true, users: [] });
      }

      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const currentUser = await User.findById(req.user.id)
        .populate('friends', 'username avatar')
        .select('friends friendRequests blockedUsers')
        .lean();

      if (!currentUser) {
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

      const blockedUserIds = currentUser.blockedUsers || [];
      const usersWhoBlockedCurrent = await User.find({ blockedUsers: req.user.id }).distinct('_id');
      const users = await User.find({
        $and: [
          {
            _id: {
              $ne: req.user.id,
              $nin: [...blockedUserIds, ...usersWhoBlockedCurrent],
            },
          },
          {
            $or: [
              { username: { $regex: escapedQuery, $options: 'i' } },
              { email: { $regex: escapedQuery, $options: 'i' } },
            ],
          },
        ],
      }).select('username email avatar isOnline friendRequests friends privacySettings');

      // Gắn trạng thái cho từng kết quả để client biết cần hiện nút gì.
      const formattedUsers = users.map((u) => formatDiscoverableUser(u, currentUser, req.user.id));

      res.status(200).json({ success: true, users: formattedUsers });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Lỗi tìm kiếm người dùng' });
    }
  },

  //Gửi lời mời kết bạn
  sendFriendRequest: async (req, res) => {
    try {
      const { recipientId } = req.body;
      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        return res.status(400).json({ error: 'recipientId không hợp lệ' });
      }
      if (recipientId === req.user.id) {
        return res.status(400).json({ error: 'Không thể tự kết bạn với chính mình' });
      }

      const currentUser = await User.findById(req.user.id);
      const targetUser = await User.findById(recipientId);
      if (!targetUser) return res.status(404).json({ error: 'Người dùng không tồn tại' });
      if (
        currentUser.blockedUsers.some((id) => id.toString() === recipientId) ||
        targetUser.blockedUsers.some((id) => id.toString() === req.user.id)
      ) {
        return res.status(403).json({ error: 'Không thể gửi lời mời đến người dùng này' });
      }
      if (currentUser.friends.some((id) => id.toString() === recipientId)) {
        return res.status(400).json({ error: 'Hai người đã là bạn bè' });
      }
      if (targetUser.friendRequests.some((id) => id.toString() === req.user.id)) {
        return res.status(400).json({ error: 'Đã gửi lời mời trước đó' });
      }
      targetUser.friendRequests.push(req.user.id);
      await targetUser.save();

      const requester = formatVisibleUser(currentUser, recipientId);
      emitToUser(req, recipientId, 'friend_request_received', { requester });
      void createNotification({
        io: req.app.get('io'),
        recipientId,
        actorId: req.user.id,
        type: 'friend_request',
        title: `${currentUser.username} đã gửi lời mời kết bạn`,
        body: 'Mở danh bạ để phản hồi lời mời.',
      });

      res.status(200).json({ success: true, message: 'Đã gửi lời mời kết bạn' });
    } catch (error) {
      res.status(500).json({ error: 'Lỗi gửi lời mời' });
    }
  },

  //Chấp nhận lời mời kết bạn
  acceptFriendRequest: async (req, res) => {
    try {
      const { requesterId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(requesterId)) {
        return res.status(400).json({ error: 'requesterId không hợp lệ' });
      }

      const currentUser = await User.findById(req.user.id);
      const requesterUser = await User.findById(requesterId);

      if (!currentUser || !requesterUser) {
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

      const hasRequest = currentUser.friendRequests.some((id) => id.toString() === requesterId);
      if (!hasRequest) {
        return res.status(400).json({ error: 'Lời mời không còn tồn tại' });
      }

      // Thêm nhau vào danh sách bạn bè
      if (!currentUser.friends.some((id) => id.toString() === requesterId)) {
        currentUser.friends.push(requesterId);
      }
      if (!requesterUser.friends.some((id) => id.toString() === req.user.id)) {
        requesterUser.friends.push(req.user.id);
      }
      // Xóa khỏi danh sách chờ
      currentUser.friendRequests = currentUser.friendRequests.filter(
        (id) => id.toString() !== requesterId,
      );

      await currentUser.save();
      await requesterUser.save();
      emitToUser(req, requesterId, 'friend_request_accepted', {
        friendId: req.user.id,
        friend: formatVisibleUser(currentUser, requesterId),
      });
      emitToUser(req, req.user.id, 'friend_request_accepted', {
        friendId: requesterId,
        friend: formatVisibleUser(requesterUser, req.user.id),
      });
      void createNotification({
        io: req.app.get('io'),
        recipientId: requesterId,
        actorId: req.user.id,
        type: 'friend_accepted',
        title: `${currentUser.username} đã chấp nhận lời mời kết bạn`,
      });
      res.status(200).json({ success: true, message: 'Đã kết bạn thành công' });
    } catch (error) {
      res.status(500).json({ error: 'Lỗi chấp nhận lời mời' });
    }
  },

  // Từ chối lời mời kết bạn đã nhận
  rejectFriendRequest: async (req, res) => {
    try {
      const { requesterId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(requesterId)) {
        return res.status(400).json({ error: 'requesterId không hợp lệ' });
      }

      const currentUser = await User.findById(req.user.id);
      if (!currentUser) {
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

      currentUser.friendRequests = currentUser.friendRequests.filter(
        (id) => id.toString() !== requesterId,
      );
      await currentUser.save();
      emitToUser(req, requesterId, 'friend_request_rejected', { userId: req.user.id });

      res.status(200).json({ success: true, message: 'Đã từ chối lời mời' });
    } catch (error) {
      console.error('Lỗi từ chối lời mời:', error);
      res.status(500).json({ error: 'Không thể từ chối lời mời' });
    }
  },

  // Hủy lời mời đã gửi
  cancelFriendRequest: async (req, res) => {
    try {
      const { recipientId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        return res.status(400).json({ error: 'recipientId không hợp lệ' });
      }

      const recipient = await User.findById(recipientId);
      if (!recipient) {
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

      recipient.friendRequests = recipient.friendRequests.filter(
        (id) => id.toString() !== req.user.id,
      );
      await recipient.save();
      emitToUser(req, recipientId, 'friend_request_cancelled', { requesterId: req.user.id });

      res.status(200).json({ success: true, message: 'Đã hủy lời mời' });
    } catch (error) {
      console.error('Lỗi hủy lời mời:', error);
      res.status(500).json({ error: 'Không thể hủy lời mời' });
    }
  },
};

export default userController;
