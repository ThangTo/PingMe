const SLOW_REQUEST_THRESHOLD_MS = Number(process.env.SLOW_REQUEST_THRESHOLD_MS || 700);

export const requestTimingMiddleware = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const originalWriteHead = res.writeHead;

  res.writeHead = function writeHeadWithTiming(...args) {
    if (process.env.NODE_ENV !== 'production' && !res.getHeader('Server-Timing')) {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      res.setHeader('Server-Timing', `app;dur=${Math.round(durationMs)}`);
    }

    return originalWriteHead.apply(this, args);
  };

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const roundedDuration = Math.round(durationMs);

    if (durationMs < SLOW_REQUEST_THRESHOLD_MS && res.statusCode < 500) return;

    const userId = req.user?.id || req.user?._id || null;
    const logPayload = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: roundedDuration,
      userId,
    };

    if (res.statusCode >= 500) {
      console.error('[PingMe] Request failed', logPayload);
    } else {
      console.warn('[PingMe] Slow request', logPayload);
    }
  });

  next();
};
