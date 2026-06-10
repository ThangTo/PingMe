import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const normalizeValue = (value = '') => String(value || '').trim().toLowerCase();

const buildKey = (req, parts = []) =>
  [ipKeyGenerator(req.ip), ...parts.map((part) => normalizeValue(part)).filter(Boolean)].join(':');

const rateLimitHandler = (req, res, _next, options) => {
  res.status(options.statusCode).json({
    error: options.message || 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
    retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime?.() - Date.now()) / 1000) || null,
  });
};

const createLimiter = ({ windowMs, limit, message, keyParts }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message,
    keyGenerator: (req) => buildKey(req, keyParts?.(req) || []),
    handler: rateLimitHandler,
  });

export const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  keyParts: (req) => [req.body?.email],
});

export const registerOtpLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 3,
  message: 'Bạn đã yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau ít phút.',
  keyParts: (req) => [req.body?.email, 'register'],
});

export const passwordOtpLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 3,
  message: 'Bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau ít phút.',
  keyParts: (req) => [req.body?.email, 'password-reset'],
});

export const verifyOtpLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  message: 'Bạn nhập OTP sai quá nhiều lần. Vui lòng yêu cầu mã mới.',
  keyParts: (req) => [req.body?.email, req.body?.purpose || req.path],
});

export const searchLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  message: 'Bạn tìm kiếm quá nhanh. Vui lòng thử lại sau.',
  keyParts: (req) => [req.user?.id || req.user?._id || 'guest', req.path],
});
