# PingMe Performance Notes

## Frontend Budget

- Auth routes should not load chat, Socket.IO, WebRTC, call UI, or virtualized message list chunks.
- Brand runtime assets live in `client/public/brand`.
- Regenerate optimized logo assets after replacing source PNGs:

```bash
cd client
npm run assets:brand
```

## Backend Hot Paths

- `GET /api/conversations` must stay read-only. Do not create direct conversations or migrate legacy messages in this request.
- New direct conversations are created when a friend request is accepted or when a direct chat is explicitly opened.
- Legacy direct messages should be migrated with:

```bash
cd server
npm run backfill:legacy-direct-messages
```

- Existing friend pairs should be backfilled once with:

```bash
cd server
npm run backfill:direct-conversations
npm run backfill:direct-conversations -- --apply
```

## Production Observability

- Slow API requests log when they exceed `SLOW_REQUEST_THRESHOLD_MS` (default `700`).
- Optional Sentry:

```env
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0
```

## Multi-Instance Realtime

Default local/dev mode uses in-memory Socket.IO rooms.

Use Redis only when running more than one backend instance:

```env
REALTIME_ADAPTER=redis
REDIS_URL=redis://...
```
