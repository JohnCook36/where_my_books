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
