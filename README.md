# rescene-account

User progress and auth for rescene (email + password login, watch/read progress sync).

Separate Postgres database from `rescene-api` (API keys / scrapers).

**Discord Rich Presence** is handled only in the Electron client (`discord-rpc`); this service does not use Discord OAuth.

## Setup

```bash
cd rescene-account
cp .env.example .env
# Set DATABASE_URL, JWT_SECRET, ANILIST_TOKEN_ENCRYPTION_KEY

bun install
bun run db:generate
bun run db:push   # fresh DB; or db:migrate if upgrading
bun run dev
```

Default port: **3001**.

## Client env (zenshin)

```env
VITE_ACCOUNT_API_URL=http://localhost:3001
```

## API

| Method | Path | Auth |
|--------|------|------|
| POST | `/v1/auth/register` | — |
| POST | `/v1/auth/login` | — |
| GET | `/v1/me` | Bearer JWT |
| GET | `/v1/progress/watch` | Bearer JWT |
| PUT | `/v1/progress/watch/:canonicalKey` | Bearer JWT |
| POST | `/v1/progress/merge` | Bearer JWT |

Register/login body: `{ "email": "...", "password": "..." }` — password min 8 characters.
