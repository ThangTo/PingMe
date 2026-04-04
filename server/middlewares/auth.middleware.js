import jwt from 'jsonwebtoken'

export const authMiddleware = (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1]

        if(!token){
            return res.status(401).json({ error: 'Bạn cần đăng nhập để thực hiện hành động này' });
        }

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        req.user = { id: decoded.userId, username: decoded.username };
        
        next();
    } catch (error) {
        console.error('Lỗi Verify Token:', error.message);
        return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
}