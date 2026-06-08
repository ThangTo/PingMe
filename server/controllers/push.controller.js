import {
  getPushConfigState,
  removeUserPushSubscription,
  saveUserPushSubscription,
  sendTestPushToUser,
} from '../services/pushNotification.service.js';

const getVapidPublicKey = (req, res) => {
  const pushConfig = getPushConfigState();

  res.json({
    success: true,
    publicKey: pushConfig.publicKey,
    isEphemeral: pushConfig.isEphemeral,
  });
};

const saveSubscription = async (req, res) => {
  try {
    const subscription = req.body?.subscription || req.body;
    const savedSubscription = await saveUserPushSubscription({
      userId: req.user.id,
      subscription,
      userAgent: req.get('user-agent') || '',
    });

    res.status(201).json({
      success: true,
      endpoint: savedSubscription.endpoint,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Khong the luu push subscription',
    });
  }
};

const sendTestNotification = async (req, res) => {
  try {
    const result = await sendTestPushToUser(req.user.id);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Khong the gui test push notification',
    });
  }
};

const deleteSubscription = async (req, res) => {
  try {
    await removeUserPushSubscription({
      userId: req.user.id,
      endpoint: req.body?.endpoint,
    });

    res.json({
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Khong the xoa push subscription',
    });
  }
};

export default {
  getVapidPublicKey,
  saveSubscription,
  deleteSubscription,
  sendTestNotification,
};
