# Server

Backend API for BookNook / WhereMyBooks.

Stack: NestJS, TypeScript, PostgreSQL, Prisma.

Local development:

```bash
cp .env.example .env
docker compose up -d postgres
npx prisma migrate dev --name init
npm run dev
```

The API listens on `http://localhost:3000` by default.

This folder is an independent application and must not contain `client` or `mobile`.

## ISBN / covers / scan drafts

See [catalog QA and acceptance](../docs/ISBN-CATALOG-QA.md). `GET /api/catalog?isbn=...` requires a bearer token, validates and canonicalizes ISBN, returns edition candidates, cover sources, partial provider failures and existing copies belonging to the current user. `GOOGLE_BOOKS_API_KEY` is a server-only optional project key; no key is exposed to mobile.

`GET/POST /api/scan-drafts` persist a private ISBN queue (maximum 50); `DELETE /api/scan-drafts/:id` removes only the current user's draft. Creating a book with `clientRequestId` equal to the draft UUID makes retries safe. Confirmation creates the library copy and consumes its matching draft atomically. A replay with a different payload is rejected with HTTP 409.

`POST /api/books` accepts ISBN, publisher/year/language, source/externalId, multiple authors, selected catalog cover and optional clientRequestId. Different keys allow independent copies, including an explicitly selected owned editionId. A key is scoped to a user and replays the original result. Do not reuse it for a different intended copy. Metadata corrections fork a personal edition snapshot so another copy is unchanged. Unknown pages use 0 in this first compatible schema extension.

Run `npm ci` from the repository root. Build shared before the server: `npm run build --workspace @where-my-books/shared`, then `npm run build --workspace @where-my-books/server`. The shared package now has a compiled ESM entrypoint shared by Node and Metro, with source TypeScript declarations.

For integration testing, apply migrations on a disposable PostgreSQL DB, then set `DATABASE_URL` and `WMB_INTEGRATION_TEST=1` and run `npm run test:integration --workspace @where-my-books/server`. The HTTP suite creates its own test accounts and checks concurrent idempotency, ownership, independent copies, ISBN/cover persistence, unknown pages, queue deduplication and API restart. CI supplies PostgreSQL 17.
