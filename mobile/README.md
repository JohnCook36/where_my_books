# Mobile

Mobile application for BookNook / WhereMyBooks.

## Stack

- Expo SDK 57
- React Native 0.86
- TypeScript 6
- Expo Router
- Emotion Native
- React Native Reanimated
- React Native Gesture Handler
- Expo Haptics

## Start

From repository root:

```bash
npm install
npm run dev:mobile
```

Android:

```bash
npm run android
```

## Current foundation

The first screen intentionally uses local mock data. It validates the product interaction before backend work starts:

- virtual bookshelf preview;
- animated reading fill directly on book spines;
- percentage/pages display switch;
- tactile book selection;
- animated reading progress bar;
- `+10 pages` action updates both the current-reading card and the book spine.

Reusable tokens and React Native UI primitives live in the top-level `ui` workspace. Pure reading-progress logic lives in `shared`.
