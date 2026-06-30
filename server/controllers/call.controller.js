import { getRtcIceConfig } from '../services/rtcConfig.service.js';

const callController = {
  getIceConfig: async (req, res) => {
    try {
      return res.status(200).json({
        success: true,
        ...getRtcIceConfig(),
      });
    } catch (error) {
      console.error('Không thể lấy RTC ICE config:', error);
      return res.status(500).json({ error: 'Không thể lấy cấu hình cuộc gọi' });
    }
  },
};

export default callController;
