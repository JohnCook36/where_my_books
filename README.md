# BookNook / WhereMyBooks

BookNook is a personal library and reading tracker focused on recreating a user's real bookshelf digitally.

## Repository structure

```text
where_my_books/
├── ui/       # Shared design tokens and reusable UI building blocks
├── shared/   # Shared domain types, contracts and pure logic
├── client/   # Web client
├── server/   # Backend API
├── mobile/   # Mobile application
├── package.json
└── tsconfig.base.json
```

All top-level applications and packages are siblings. Nothing is nested inside another application.

## Sharing rules

- `ui` is consumed by `mobile` and later by `client`.
- `ui` owns design tokens, motion tokens and reusable components where sharing is practical.
- Platform-specific UI implementations are allowed when web and React Native need different primitives.
- `shared` owns pure TypeScript domain models, validation/contracts and reusable business logic.
- `server` never depends on UI.

## Product principles

- Personal library first.
- A virtual shelf should visually represent a real shelf.
- Reading progress must be visible directly on books and shelves.
- The user can choose progress display as percentage or pages.
- Motion and micro-interactions are a core part of the product experience.
- Private notes/quotes and public reviews are separate concepts.

## Stack decisions

- `mobile`: Expo + React Native + TypeScript + Expo Router + Emotion + Reanimated.
- `client`: React + TypeScript + Vite + Emotion. Vite is the fixed web build/dev tool for fast startup and HMR.
- `server`: NestJS + TypeScript + PostgreSQL + Prisma.

## Current development focus

The first implementation target is `mobile`.

Current mobile foundation: Expo SDK 57, React Native, TypeScript, Expo Router, Emotion, Reanimated and Gesture Handler.
