import jwt from 'jsonwebtoken'
import Session from '../models/Session.js'

export const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1]

        if(!token){
            return res.status(401).json({ error: 'Bạn cần đăng nhập để thực hiện hành động này' });
        }

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        if (decoded.sid) {
            const activeSession = await Session.exists({
                sessionId: decoded.sid,
                user: decoded.userId,
                revokedAt: null,
                expiresAt: { $gt: new Date() },
            })
            if (!activeSession) {
                return res.status(401).json({ error: 'Phiên đăng nhập đã bị thu hồi' })
            }
        }

        req.user = { id: decoded.userId, username: decoded.username, sessionId: decoded.sid || null };
        
        next();
    } catch (error) {
        console.error('Lỗi Verify Token:', error.message);
        return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
}
