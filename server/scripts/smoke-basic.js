import { io as createSocket } from 'socket.io-client';

const apiBaseUrl = process.env.SMOKE_API_URL || 'http://localhost:3001/api';
const serverUrl = new URL(apiBaseUrl).origin;
const email = process.env.SMOKE_USER_EMAIL;
const password = process.env.SMOKE_USER_PASSWORD;

if (!email || !password) {
  console.error('Thiếu SMOKE_USER_EMAIL hoặc SMOKE_USER_PASSWORD.');
  process.exit(1);
}

const readCookies = (headers) => {
  const setCookies = headers.getSetCookie?.() || [headers.get('set-cookie')].filter(Boolean);
  return setCookies.map((cookie) => cookie.split(';')[0]).join('; ');
};

const loginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!loginResponse.ok) throw new Error(`Login smoke failed: ${loginResponse.status}`);
const cookies = readCookies(loginResponse.headers);

const conversationsResponse = await fetch(`${apiBaseUrl}/conversations`, {
  headers: { cookie: cookies },
});
if (!conversationsResponse.ok) {
  throw new Error(`Get conversations smoke failed: ${conversationsResponse.status}`);
}
const conversationsPayload = await conversationsResponse.json();
const directConversation = (conversationsPayload.conversations || []).find(
  (conversation) => conversation.type === 'direct',
);
if (!directConversation) throw new Error('Cần ít nhất một direct conversation để smoke test.');

for (const path of [
  '/auth/sessions',
  '/notifications?limit=1',
  '/search/messages?q=smoke&limit=1',
  '/social/blocked',
]) {
  const response = await fetch(`${apiBaseUrl}${path}`, { headers: { cookie: cookies } });
  if (!response.ok) throw new Error(`${path} smoke failed: ${response.status}`);
}

const tempId = `smoke-${Date.now()}`;
const socket = createSocket(serverUrl, {
  transports: ['websocket'],
  extraHeaders: { Cookie: cookies },
});

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Socket smoke timeout')), 10_000);

  socket.on('connect_error', reject);
  socket.on('connect', () => {
    socket.emit('register_user');
    socket.emit('send_message', {
      tempId,
      conversationId: directConversation._id || directConversation.id,
      content: `[PingMe smoke test ${new Date().toISOString()}]`,
    });
  });
  socket.on('message_sent', (message) => {
    if (message.tempId !== tempId) return;
    clearTimeout(timeout);
    console.log(`Smoke OK: login, conversations, socket send_message -> ${message.id}`);
    resolve();
  });
  socket.on('error', (error) => {
    clearTimeout(timeout);
    reject(new Error(error?.message || 'Socket smoke error'));
  });
});

socket.disconnect();
await fetch(`${apiBaseUrl}/auth/logout`, {
  method: 'POST',
  headers: { cookie: cookies },
});
