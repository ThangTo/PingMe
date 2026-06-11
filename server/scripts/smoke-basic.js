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

const createSavedConversation = async () => {
  const response = await fetch(`${apiBaseUrl}/conversations/saved`, {
    method: 'POST',
    headers: { cookie: cookies },
  });
  if (!response.ok) throw new Error(`Saved conversation smoke failed: ${response.status}`);

  const payload = await response.json();
  const conversation = payload.conversation;
  if (!conversation?.isSaved || conversation.type !== 'saved') {
    throw new Error('Saved conversation smoke returned invalid payload.');
  }

  return conversation;
};

const savedConversation = await createSavedConversation();
const savedConversationAgain = await createSavedConversation();
const savedConversationId = savedConversation._id || savedConversation.id;
const savedConversationAgainId = savedConversationAgain._id || savedConversationAgain.id;
if (!savedConversationId || savedConversationId !== savedConversationAgainId) {
  throw new Error('Saved conversation smoke created duplicate conversations.');
}

const conversationsResponse = await fetch(`${apiBaseUrl}/conversations`, {
  headers: { cookie: cookies },
});
if (!conversationsResponse.ok) {
  throw new Error(`Get conversations smoke failed: ${conversationsResponse.status}`);
}
const conversationsPayload = await conversationsResponse.json();
const savedConversationInList = (conversationsPayload.conversations || []).find(
  (conversation) => conversation.isSaved || conversation.type === 'saved',
);
if (!savedConversationInList) throw new Error('Không tìm thấy Tin nhắn đã lưu trong danh sách.');

const directConversation = (conversationsPayload.conversations || []).find(
  (conversation) => conversation.type === 'direct',
);
if (!directConversation) throw new Error('Cần ít nhất một direct conversation để smoke test.');
const directConversationId = directConversation._id || directConversation.id;

const draftContent = `PingMe draft smoke ${Date.now()}`;
const draftResponse = await fetch(`${apiBaseUrl}/conversations/${directConversationId}/draft`, {
  method: 'PUT',
  headers: { cookie: cookies, 'content-type': 'application/json' },
  body: JSON.stringify({ content: draftContent }),
});
if (!draftResponse.ok) throw new Error(`Create draft smoke failed: ${draftResponse.status}`);

const draftsResponse = await fetch(`${apiBaseUrl}/conversations/drafts`, {
  headers: { cookie: cookies },
});
if (!draftsResponse.ok) throw new Error(`Get drafts smoke failed: ${draftsResponse.status}`);
const draftsPayload = await draftsResponse.json();
const draftInList = (draftsPayload.drafts || []).find(
  (draft) => draft.conversationId === directConversationId && draft.content === draftContent,
);
if (!draftInList) throw new Error('Không tìm thấy bản nháp vừa tạo trong danh sách.');

const tooLongDraftResponse = await fetch(`${apiBaseUrl}/conversations/${directConversationId}/draft`, {
  method: 'PUT',
  headers: { cookie: cookies, 'content-type': 'application/json' },
  body: JSON.stringify({ content: 'x'.repeat(5001) }),
});
if (tooLongDraftResponse.ok) throw new Error('Draft max length smoke should fail.');

const inaccessibleDraftResponse = await fetch(
  `${apiBaseUrl}/conversations/000000000000000000000000/draft`,
  {
    method: 'PUT',
    headers: { cookie: cookies, 'content-type': 'application/json' },
    body: JSON.stringify({ content: 'should fail' }),
  },
);
if (inaccessibleDraftResponse.ok) throw new Error('Draft membership smoke should fail.');

const deleteDraftResponse = await fetch(`${apiBaseUrl}/conversations/${directConversationId}/draft`, {
  method: 'DELETE',
  headers: { cookie: cookies },
});
if (!deleteDraftResponse.ok) throw new Error(`Delete draft smoke failed: ${deleteDraftResponse.status}`);

const scheduledContent = `PingMe scheduled smoke ${Date.now()}`;
const scheduledAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
const scheduledResponse = await fetch(`${apiBaseUrl}/messages/scheduled`, {
  method: 'POST',
  headers: { cookie: cookies, 'content-type': 'application/json' },
  body: JSON.stringify({
    conversationId: directConversationId,
    content: scheduledContent,
    scheduledAt,
  }),
});
if (!scheduledResponse.ok) {
  throw new Error(`Create scheduled message smoke failed: ${scheduledResponse.status}`);
}
const scheduledPayload = await scheduledResponse.json();
const scheduledMessageId = scheduledPayload.scheduledMessage?.id;
if (!scheduledMessageId) throw new Error('Scheduled message smoke did not return an id.');

const scheduledListResponse = await fetch(
  `${apiBaseUrl}/messages/scheduled?conversationId=${directConversationId}&status=pending`,
  {
    headers: { cookie: cookies },
  },
);
if (!scheduledListResponse.ok) {
  throw new Error(`List scheduled messages smoke failed: ${scheduledListResponse.status}`);
}
const scheduledListPayload = await scheduledListResponse.json();
const scheduledInList = (scheduledListPayload.scheduledMessages || []).find(
  (scheduledMessage) =>
    scheduledMessage.id === scheduledMessageId && scheduledMessage.content === scheduledContent,
);
if (!scheduledInList) throw new Error('Không tìm thấy tin nhắn hẹn gửi vừa tạo trong danh sách.');

const emptyScheduledResponse = await fetch(`${apiBaseUrl}/messages/scheduled`, {
  method: 'POST',
  headers: { cookie: cookies, 'content-type': 'application/json' },
  body: JSON.stringify({
    conversationId: directConversationId,
    content: '   ',
    scheduledAt,
  }),
});
if (emptyScheduledResponse.ok) throw new Error('Scheduled empty content smoke should fail.');

const tooLongScheduledResponse = await fetch(`${apiBaseUrl}/messages/scheduled`, {
  method: 'POST',
  headers: { cookie: cookies, 'content-type': 'application/json' },
  body: JSON.stringify({
    conversationId: directConversationId,
    content: 'x'.repeat(5001),
    scheduledAt,
  }),
});
if (tooLongScheduledResponse.ok) throw new Error('Scheduled max length smoke should fail.');

const pastScheduledResponse = await fetch(`${apiBaseUrl}/messages/scheduled`, {
  method: 'POST',
  headers: { cookie: cookies, 'content-type': 'application/json' },
  body: JSON.stringify({
    conversationId: directConversationId,
    content: 'should fail',
    scheduledAt: new Date(Date.now() - 60 * 1000).toISOString(),
  }),
});
if (pastScheduledResponse.ok) throw new Error('Scheduled past time smoke should fail.');

const tooFarScheduledResponse = await fetch(`${apiBaseUrl}/messages/scheduled`, {
  method: 'POST',
  headers: { cookie: cookies, 'content-type': 'application/json' },
  body: JSON.stringify({
    conversationId: directConversationId,
    content: 'should fail',
    scheduledAt: new Date(Date.now() + 366 * 24 * 60 * 60 * 1000).toISOString(),
  }),
});
if (tooFarScheduledResponse.ok) throw new Error('Scheduled too-far future smoke should fail.');

const cancelScheduledResponse = await fetch(
  `${apiBaseUrl}/messages/scheduled/${scheduledMessageId}`,
  {
    method: 'DELETE',
    headers: { cookie: cookies },
  },
);
if (!cancelScheduledResponse.ok) {
  throw new Error(`Cancel scheduled message smoke failed: ${cancelScheduledResponse.status}`);
}

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
      conversationId: directConversationId,
      content: `[PingMe smoke test ${new Date().toISOString()}]`,
    });
  });
  socket.on('message_sent', (message) => {
    if (message.tempId !== tempId) return;
    clearTimeout(timeout);
    console.log(`Smoke OK: login, saved conversation, conversations, socket send_message -> ${message.id}`);
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
