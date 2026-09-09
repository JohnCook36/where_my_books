# BookNook / WhereMyBooks

BookNook is a personal library and reading-tracker project focused on recreating a user's real bookshelf digitally.

## Repository structure

```text
where_my_books/
├── client/   # Web client
├── server/   # Backend API
├── mobile/   # Mobile application
├── package.json
├── tsconfig.base.json
└── .gitignore
```

`client`, `server`, and `mobile` are independent sibling applications. None of them is nested inside another.

## Product principles

- Personal library first.
- A virtual shelf should visually represent a real shelf.
- Reading progress must be visible directly on books/shelves.
- The user can choose progress display as percentage or pages.
- Motion and micro-interactions are a core part of the product experience.
- Book metadata and covers should be enrichable from external book sources while the app keeps its own data model.
- Private notes/quotes and public reviews are separate concepts.

## Planned stack

- `client`: React + TypeScript + Vite + Emotion
- `server`: NestJS + TypeScript + PostgreSQL + Prisma
- `mobile`: Expo + React Native + TypeScript + Expo Router + Emotion + Reanimated
