# SeedThought

SeedThought turns saved X posts into learning notes and publishing drafts. It
supports manual posts, Gemini-powered classification, one-shot learning cards,
strict-learning (さとり式) output, generated SNS drafts, and X OAuth sync.

## Local Setup

SeedThought now uses PostgreSQL for both production and ongoing development.
The previous `dev.db` SQLite file is local backup data only and is not used by
the current app runtime.

```bash
pnpm install
Copy-Item .env.example .env
pnpm run db:deploy
pnpm run db:seed
pnpm dev
```

Open http://localhost:3000 for `pnpm dev`. If port 3000 is occupied, Next.js may
choose another port. For the built preview used during local verification:

```bash
pnpm build
pnpm preview
```

Open http://localhost:3003.

## Environment

Required local and production variables:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
AI_PROVIDER="gemini"
GEMINI_API_KEY="..."
GEMINI_MODEL="gemini-2.0-flash"
X_CLIENT_ID="..."
X_CLIENT_SECRET="..."
X_REDIRECT_URI="http://localhost:3003/api/x/callback"
X_SCOPES="tweet.read users.read offline.access"
TOKEN_ENCRYPTION_KEY="replace-with-a-long-random-string"
```

Use a long random value for `TOKEN_ENCRYPTION_KEY` and never commit real secret
values. For a demo without external AI, set `AI_PROVIDER="mock"`.

## Database

Create a Neon or Vercel Postgres database and set `DATABASE_URL` to its pooled
or serverless-safe connection string. Apply migrations with:

```bash
pnpm run db:deploy
```

For local schema changes during development, use:

```bash
pnpm run db:migrate
```

Use seed data only when you want sample posts:

```bash
pnpm run db:seed
```

## Vercel Production

1. Create a Vercel project from this repository.
2. Connect Neon/Vercel Postgres and set `DATABASE_URL`.
3. Add the required environment variables in Vercel Project Settings.
4. Set `X_REDIRECT_URI` to `https://<vercel-domain>/api/x/callback`.
5. Run `pnpm run db:deploy` against the production `DATABASE_URL`.
6. Deploy with the configured `pnpm build` command.
7. Enable Vercel Deployment Protection or Password Protection for personal use.

The app does not include application-level login. Do not expose the production
deployment without Vercel-side protection unless you add authentication first.

## X Developer Portal

Configure the X app as OAuth 2.0 with PKCE and add callback URLs that exactly
match the environment values you use:

- Local preview: `http://localhost:3003/api/x/callback`
- Production: `https://<vercel-domain>/api/x/callback`

Minimum scopes for OAuth connection:

- `tweet.read`
- `users.read`
- `offline.access`

Additional scopes for sync:

- `like.read`
- `bookmark.read`

If you change scopes, disconnect and reconnect the X account so the token is
issued with the new permissions.

## Common Commands

```bash
pnpm dev
pnpm preview
pnpm lint
pnpm build
pnpm run db:generate
pnpm run db:migrate
pnpm run db:deploy
pnpm run db:status
pnpm run db:seed
pnpm run db:reset
pnpm run db:studio
./node_modules/.bin/tsc.CMD --noEmit
```

## Verification Flow

1. Add a manual post from `/posts/new`.
2. Confirm the Gemini classification appears on the home page and post detail.
3. Open `/posts/[id]/confirm` and click "学習カードを生成".
4. Confirm the learning card renders (要約・構造・手順・マニュアル・応用・図解・画像生成プロンプト).
5. From the learning card page, click "厳密学習で出力" and confirm the 9-section
   strict-learning view renders.
6. Generate X / Instagram / note / Markdown / セミナー outputs and confirm
   history is preserved per learning card.
7. Connect X from `/settings/x`, then disconnect to verify the full OAuth loop.
8. If `like.read` and `bookmark.read` are enabled, run likes/bookmarks sync.

## Browser Extension

`extension/` contains a Manifest V3 Chrome extension that lets you send any
webpage (note, Zenn, Qiita, blogs, …) to SeedThought via right-click or a popup
button. Load it from `chrome://extensions` in developer mode and point it at
your SeedThought URL. See [extension/README.md](extension/README.md) for setup
and the optional `EXTENSION_TOKEN` shared-secret flow.

## Git/Data Notes

`.env`, `.next`, `dev.db`, and `src/generated/prisma` are local/generated files
and are intentionally ignored. Commit the Prisma schema, migrations, README, and
configuration files. Do not commit real database backups or secret values.
