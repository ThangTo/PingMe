import { getRtcIceConfig } from '../services/rtcConfig.service.js';

const callController = {
  getIceConfig: async (req, res) => {
    try {
      return res.status(200).json({
        success: true,
        ...getRtcIceConfig(),
      });
    } catch (error) {
      console.error('Khong the lay RTC ICE config:', error);
      return res.status(500).json({ error: 'Khong the lay cau hinh cuoc goi' });
    }
  },
};

export default callController;
