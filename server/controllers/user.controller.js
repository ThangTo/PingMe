import User from '../models/User.js';

const userController = {
  //Lấy toàn bộ user
  getAllUsers: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      // Lấy tất cả user trừ chính mình, chỉ lấy các trường cần thiết
      const users = await User.find({ _id: { $ne: currentUserId } }).select(
        'username email avatar isOnline',
      );

      res.status(200).json({
        success: true,
        users,
      });
    } catch (error) {
      res.status(500).json({ error: 'Không thể lấy danh sách người dùng' });
    }
  },

  //Lấy danh sách bạn bè
  getFriends: async (req, res) => {
    try {
      const user = await User.findById(req.user.id).populate(
        'friends',
        'username email avatar isOnline',
      );
      res.status(200).json({ success: true, friends: user.friends });
    } catch (error) {
      res.status(500).json({ error: 'Không thể lấy danh sách bạn bè' });
    }
  },

  //Lấy danh sách lời mời kết bạn
  getFriendRequests: async (req, res) => {
    try {
      const user = await User.findById(req.user.id).populate(
        'friendRequests',
        'username email avatar isOnline',
      );
      res.status(200).json({ success: true, requests: user.friendRequests });
    } catch (error) {
      res.status(500).json({ error: 'Không thể lấy danh sách lời mời' });
    }
  },

  // Tìm kiếm user
  searchUsers: async (req, res) => {
    try {
      const { query } = req.query;
      const currentUser = await User.findById(req.user.id);

      const users = await User.find({
        $and: [
          { _id: { $ne: req.user.id } },
          {
            $or: [
              { username: { $regex: query, $options: 'i' } },
              { email: { $regex: query, $options: 'i' } },
            ],
          },
        ],
      }).select('username email avatar isOnline friendRequests');

      // Gắn trạng thái cho từng kết quả
      const formattedUsers = users.map((u) => {
        let status = 'none'; // Mặc định: chưa có quan hệ gì
        if (currentUser.friends.includes(u._id)) status = 'friend';
        else if (u.friendRequests.includes(req.user.id)) status = 'sent';
        else if (currentUser.friendRequests.includes(u._id)) status = 'received';

        return {
          _id: u._id,
          username: u.username,
          avatar: u.avatar,
          isOnline: u.isOnline,
          status: status,
        };
      });

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
      const targetUser = await User.findById(recipientId);
      if (!targetUser) return res.status(404).json({ error: 'Người dùng không tồn tại' });
      if (targetUser.friendRequests.includes(req.user.id)) {
        return res.status(400).json({ error: 'Đã gửi lời mời trước đó' });
      }
      targetUser.friendRequests.push(req.user.id);
      await targetUser.save();

      res.status(200).json({ success: true, message: 'Đã gửi lời mời kết bạn' });
    } catch (error) {
      res.status(500).json({ error: 'Lỗi gửi lời mời' });
    }
  },

  //Chấp nhận lời mời kết bạn
  acceptFriendRequest: async (req, res) => {
    try {
      const { requesterId } = req.body;
      const currentUser = await User.findById(req.user.id);
      const requesterUser = await User.findById(requesterId);
      // Thêm nhau vào danh sách bạn bè
      currentUser.friends.push(requesterId);
      requesterUser.friends.push(req.user.id);
      // Xóa khỏi danh sách chờ
      currentUser.friendRequests = currentUser.friendRequests.filter(
        (id) => id.toString() !== requesterId,
      );

      await currentUser.save();
      await requesterUser.save();
      res.status(200).json({ success: true, message: 'Đã kết bạn thành công' });
    } catch (error) {
      res.status(500).json({ error: 'Lỗi chấp nhận lời mời' });
    }
  },
};

export default userController;
