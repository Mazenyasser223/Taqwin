# Node ↔ FastAPI contract (Phase 0–1)

## `POST /chat`

**Headers**

- `Content-Type: application/json`
- `X-Internal-Key` — must match `AI_INTERNAL_KEY` in Node and FastAPI when set

**Request**

```json
{
  "userId": "uuid",
  "locale": "ar",
  "messages": [{ "role": "user", "content": "مرحباً" }],
  "contextBundle": {},
  "threadId": "optional-conversation-id"
}
```

**Response**

```json
{
  "reply": "تم استلام رسالتك من Taqwin AI Coach.",
  "mode": "echo"
}
```

## `GET /health`

```json
{ "ok": true, "service": "taqwin-ai", "mode": "echo" }
```
