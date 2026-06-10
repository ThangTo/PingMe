let sentry = null;

export const initializeErrorReporter = async () => {
  if (!process.env.SENTRY_DSN) return;

  sentry = await import('@sentry/node');
  sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
  });

  console.log('[PingMe] Error reporter: sentry');
};

export const reportError = (error, context = {}) => {
  if (!sentry) return;
  sentry.captureException(error, {
    extra: context,
  });
};
