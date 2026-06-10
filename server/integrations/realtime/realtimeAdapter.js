export const configureRealtimeAdapter = async (io) => {
  const adapter = (process.env.REALTIME_ADAPTER || 'memory').toLowerCase();

  if (adapter === 'memory') {
    console.log('[PingMe] Realtime adapter: memory');
    return null;
  }

  if (adapter !== 'redis') {
    throw new Error(`Unsupported REALTIME_ADAPTER: ${adapter}`);
  }

  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is required when REALTIME_ADAPTER=redis');
  }

  const [{ createClient }, { createAdapter }] = await Promise.all([
    import('redis'),
    import('@socket.io/redis-adapter'),
  ]);

  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (error) => console.error('[PingMe] Redis pub client error:', error));
  subClient.on('error', (error) => console.error('[PingMe] Redis sub client error:', error));

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  console.log('[PingMe] Realtime adapter: redis');

  return async () => {
    await Promise.allSettled([pubClient.quit(), subClient.quit()]);
  };
};
