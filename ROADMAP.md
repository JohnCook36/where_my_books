# Roadmap — BookNook / WhereMyBooks

## Правила работы

1. Сначала развиваем мобильное приложение.
2. Переиспользуемые UI-компоненты и design/motion tokens выносим в `ui`.
3. Чистые типы, доменную логику, контракты и утилиты выносим в `shared`.
4. `client`, `server`, `mobile`, `ui`, `shared` остаются соседними top-level workspace.
5. Крупные изменения проверяем через `npm run typecheck`, `npm run lint` и `npm run test`.
6. Баги уже реализованного функционала можно исправлять вне очереди, если они блокируют работу.
7. Если работа не относится к текущему этапу, явно обозначаем: `⚠️ Это отход от roadmap`.
8. Плавность, микровзаимодействия и тактильность являются частью функциональности.
9. Новая бизнес-логика в `shared` и `server` должна сопровождаться unit-тестами там, где поведение можно проверить детерминированно.
10. Исправление воспроизводимого бага по возможности сопровождается regression test, чтобы ошибка не вернулась.

## Архитектурное правило данных

Для синхронизируемых пользовательских данных backend/PostgreSQL является основным серверным источником истины. Мобильный SQLite не проектируется независимо от backend. Если offline-first понадобится, локальная база добавляется позже как часть заранее спроектированного sync layer.

## Этап 0. Фундамент проекта

**Статус: ✅ завершён**

- [x] monorepo/workspaces;
- [x] соседние `mobile`, `client`, `server`, `ui`, `shared`;
- [x] Expo, React Native, TypeScript, Expo Router;
- [x] Emotion Native, Reanimated, Gesture Handler, Haptics;
- [x] базовые design и motion tokens;
- [x] shared-логика расчёта прогресса;
- [x] первый прототип виртуальной полки;
- [x] локальный Android development build;
- [x] Vitest foundation для `shared` и `npm run test` в CI;
- [x] Expo/RN-зависимости приведены к совместимым версиям;
- [x] чистая установка зависимостей;
- [x] `expo-doctor`: 21/21;
- [x] `npm run test`: 16/16;
- [x] CI проверяет install, typecheck, lint и tests.

## Этап 1. App Shell, навигация и дизайн-система

**Статус: 🔎 готов к ручной проверке**

- [x] `(tabs)` navigation;
- [x] Главная, Библиотека, Добавить, Статистика, Профиль;
- [x] Stack-маршруты книги, полок и настроек;
- [x] `ScreenContainer`, `AppHeader`, `BackButton`;
- [x] `SegmentedControl`, Loading/Empty/Error states;
- [x] typography tokens;
- [x] Reduce Motion для stack-переходов и ключевых Reanimated-компонентов;
- [x] текущая virtual shelf, текущая книга и progress overlay;
- [x] переключение `% / Страницы`;
- [x] `+10 страниц`, анимации и haptics.

Окончательное закрытие этапа выполняется после ручной проверки владельцем проекта.

## Этап 2. Domain model и API contracts

**Статус: ✅ завершён для MVP-среза**

Цель — подготовить серверную модель и контракты до реализации backend.

- [x] `Author`;
- [x] `BookWork`;
- [x] `Edition`;
- [x] `BookCopy`;
- [x] `ReadingStatus`;
- [x] `ReadingProgress`;
- [x] `Shelf`;
- [x] `ShelfSection`;
- [x] `ShelfPlacement`;
- [x] `ProgressDisplayMode`;
- [x] `UserSettings`;
- [x] зафиксировать глобальную стратегию ID (UUID на сервере, string в контрактах);
- [x] определить DTO/API contracts;
- [x] описать разделение metadata и user-owned data;
- [x] подготовить модели к будущей синхронизации (timestamps);
- [x] покрыть runtime-логику и контракты unit-тестами по мере их появления.

На этом этапе не реализуются SQLite, migrations, local repositories и local database schema.

## Этап 3. Backend foundation

**Статус: ✅ MVP-срез завершён**

Backend реализуется раньше полноценного mobile data layer.

- [x] NestJS foundation;
- [x] PostgreSQL + Prisma;
- [x] Prisma schema и migrations;
- [x] registration/login;
- [x] access/refresh session model;
- [x] API contracts;
- [x] API библиотеки;
- [ ] API полок (после MVP);
- [x] API reading progress;
- [x] API settings;
- [x] глобальные IDs;
- [x] timestamps для будущей синхронизации.

Backend проектируется с учётом возможного будущего offline mobile storage.

## Этап 4. Mobile API integration и Library CRUD

**Статус: ✅ MVP-срез завершён**

- [x] API client;
- [x] mobile data layer без SQLite как source of truth;
- [x] loading/error states для сетевых данных;
- [x] библиотека на backend;
- [x] добавление и удаление API (редактирование — через детали в следующем срезе);
- [x] Book Details;
- [ ] поиск внутри своей библиотеки;
- [ ] фильтры и сортировки;
- [ ] несколько экземпляров одного произведения.

## Этап 5. Reading Progress

**Статус: ✅ MVP-срез завершён**

- [x] current page;
- [x] `% / страницы` в shared и backend model;
- [ ] быстрые действия `+5`, `+10`, `+25` (следующий UI-срез);
- [x] ручной ввод;
- [ ] даты начала и окончания;
- [ ] история прогресса;
- [ ] progress overlay;
- [x] сохранение через backend.

## Этап 6. Virtual Shelf MVP

- [ ] несколько шкафов;
- [ ] секции и полки;
- [ ] назначение книги на полку;
- [ ] физический порядок книг;
- [ ] drag & drop;
- [ ] long press и lift-анимация;
- [ ] визуальные параметры корешка;
- [ ] быстрый переход в детали;
- [ ] режим `Real Shelf`;
- [ ] поиск физического расположения.

## Этап 7. Catalog / ISBN

- [ ] provider interface;
- [ ] Google Books;
- [ ] Open Library fallback;
- [ ] поиск по названию, автору и ISBN;
- [ ] выбор конкретного издания;
- [ ] covers;
- [ ] barcode scanner;
- [ ] кеширование внешних результатов.

## Этап 8. Offline cache / sync

SQLite допускается только после проектирования sync protocol.

До реализации определить:

- server source of truth;
- global IDs и client-generated IDs;
- record versioning;
- `createdAt` и `updatedAt`;
- deletion/tombstones;
- conflict strategy;
- pending local mutations;
- sync cursor/version;
- поведение нескольких устройств.

После этого, если offline-first действительно нужен:

- [ ] добавить SQLite как локальный cache;
- [ ] очередь offline mutations;
- [ ] sync engine;
- [ ] conflict handling;
- [ ] migrations mobile DB.

## Этап 9. Reading Journal

- [ ] заметки;
- [ ] цитаты;
- [ ] привязка к странице;
- [ ] оценка;
- [ ] spoiler-флаг;
- [ ] история книги;
- [ ] поиск по заметкам и цитатам.

## Этап 10. Статистика и цели

- [ ] прочитанные книги;
- [ ] страницы;
- [ ] серии и авторы;
- [ ] цели чтения;
- [ ] streak;
- [ ] годовая статистика;
- [ ] спокойная визуализация без перегруза.

## Этап 11. Social / Reviews

- [ ] публичный профиль;
- [ ] друзья;
- [ ] подписки;
- [ ] отзывы;
- [ ] рекомендации;
- [ ] privacy controls;
- [ ] модерация.

## Этап 12. Полировка и mobile release

- [ ] accessibility;
- [ ] performance;
- [ ] offline/error UX;
- [ ] analytics;
- [ ] crash reporting;
- [ ] onboarding;
- [ ] Android release;
- [ ] iOS release.

## Этап 13. Web client

Web-клиент остаётся отдельным приложением на:

```text
React + TypeScript + Vite + Emotion
```

- [ ] подключение к backend API;
- [ ] библиотека;
- [ ] полки;
- [ ] прогресс;
- [ ] статистика;
- [ ] профиль и настройки.
