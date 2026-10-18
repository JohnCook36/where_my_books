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

**Статус: 🟡 foundation готов, acceptance MVP в работе**

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

**Статус: 🟡 MVP-срез в работе**

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

**Статус: 🟡 MVP-срез в работе**

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


## Полный продукт: актуализация 2026-10-16

Предыдущие отметки выше сохранены как история `feat/usable-mvp`, а не доказательство merge в main или финальной приёмки. Сверка веток: [audit](docs/AUDIT-2026-10-16.md). Требования: [product](docs/PRODUCT-REQUIREMENTS.md). Notion HQ: https://app.notion.com/p/3fa043746cc681319116c2663a49797a

| Этап | Содержание | Зависимости | Acceptance | Статус |
|---|---|---|---|---|
| A | Audit / HQ / матрица / план | — | SHA/API/CI/риски зафиксированы | аудит и HQ зафиксированы |
| B | Auth / PostgreSQL / CRUD / owner isolation / idempotency | A | live PG, два аккаунта, restart, CI | базовый auth/CRUD проверен; полный B открыт |
| C | ISBN / Google + OpenLibrary / edition / covers / camera / bulk | B minimal | сценарии 1,2,3,7,8,9 и настоящий Android | scanner/review/batch/covers реализованы; оставшиеся пункты открыты |
| D | Комнаты/шкафы/секции/полки/позиции/корешки/DnD/Undo | B | сценарии 4,5 и доступная перестановка | backlog |
| E | Diary/quotes/history/sessions/timer/goals/stats | B | persistence и верная аналитика | backlog |
| F | Collections/wishlist/series/loans/import/export/restore | B | ownership отдельно от wishlist, safe repeat/restore | backlog |
| G | Sync protocol и Vite Web, offline только после дизайна | B | два устройства, конфликты/удаления | backlog |
| H | Public/friends/reviews/recommendations/privacy/moderation | B,E,F | права и приватность проверены | backlog |
| I | Regression/a11y/performance/backup/Android+iOS/production | B–H | release gates и приёмка | backlog |

Catalog/ISBN переносится перед расширенной виртуальной библиотекой как явно согласованный владельцем приоритет. Этапы 0–13 выше не удаляются. MVP не является завершением продукта.

Следующие поставки C: (1) ISBN+metadata+сохранение выбора+камера; (2) durable bulk queue и batch confirm; (3) private photo upload/crop/rotate/reset и cover policy; (4) real Android acceptance. Каждый блок — один связный PR с тестами и документацией, не отдельный PR на файл.

### Продолжение C — review drafts и партия (2026-10-16)

- [x] Реализация сохранения редактируемого payload/обложки и восстановления формы.
- [x] Реализация ревизий, PATCH replay и защиты от перезаписи на другом устройстве.
- [x] Реализация готовности к партии, confirm-all, отдельных результатов и безопасного повторного подтверждения.
- [x] PostgreSQL/HTTP acceptance backend revision `73606e1`: CI run `38829528333` success, включая частичный DB-сбой и rollback.
- [ ] Ручная приёмка batch UX/navigation на настоящем Android/iOS.
- [ ] Общий шкаф/полка для партии — после модели размещения D.

См. [протокол и acceptance](docs/SCAN-BATCH-REVIEW.md). Проверки implementation и финальная приёмка учитываются отдельно; этап C целиком не закрывается.

### Продолжение C — private covers и порядок приёмки (2026-10-16)

- [x] Реализация CoverAsset, private upload/read, owner validation, MIME/magic/decode/byte/pixel bounds и EXIF stripping.
- [x] Галерея/фото, crop/rotate/reset/cancel, применение к copy и review draft, возврат automatic и placeholder.
- [x] Автоматические регрессии обработки изображений/геометрии; расширение PostgreSQL HTTP suite для полного private-cover пути.
- [ ] Физическая приёмка камеры, picker и crop UX — **по решению владельца после сборки функциональности приложения**, не блокирует текущую разработку.
- [ ] До production: retention/лимиты совокупного storage, backup/restore изображений, масштабирование private storage.

Описание: [private covers](docs/PRIVATE-COVERS.md). Изменение требований владельца: ручные Android-проверки пока не проводим; автоматические проверки кода/API сохраняются. Следующие зависимости: оставшийся внешний title/author search и стили заглушки, затем D (server placement, комнаты/шкафы/секции/полки и реальный интерфейс).

### Продолжение C — title/author fallback и стили (2026-10-16)

- [x] Реализован нормализованный поиск Google/OpenLibrary по названию/автору с пагинацией, ограничениями, cache/coalescing и partial outage.
- [x] Work/edition различаются; нет подмены scanned ISBN или автоматической work cover.
- [x] Модальный поиск, выбор ISBN/Google edition, перенос только title/authors, owner-scoped «уже в библиотеке».
- [x] Четыре стиля типографической обложки, shared enum, UI tokens и персональное сохранение copy/review.
- [ ] Полная native UX-приёмка после сборки приложения — по решению владельца.

[Контракт и проверки](docs/CATALOG-SEARCH-STYLES.md). Следующий функциональный блок D: серверные комнаты/шкафы/секции/полки/позиции, реальные корешки и общее место партии. Не считать C или весь продукт принятыми только по написанному коду/CI.

### D — реальные места и motion, первый срез (2026-10-17)

- [x] Реализация StorageRoom/Shelf/ShelfSection/ShelfRow/ShelfPlacement, composite owner FK и additive migration.
- [x] Account layout revision, strict actions, request receipts, replay/CAS и Undo move/sort.
- [x] Безопасное удаление контейнера и revision-aware удаление copy.
- [x] Реальный экран шкафа: создание/переименование/удаление, места, path search, группа до50 и связь с scan batch.
- [x] UI-thread lift/drag/gap/reorder/arrival/progress, общие tokens, live Reduce Motion, доступный перенос и единый native modal host.
- [ ] Подтверждение PG/HTTP на текущем SHA и последующая native/owner motion приёмка.
- [ ] Межстрочный drag/edge autoscroll, реальные размеры и fit, все режимы просмотра/расширенные настройки шкафа.

[Модель, motion и проверки](docs/REAL-SHELF-MOTION.md). Пользователь17.10 отдельно подтвердил важность красивого motion. Android manual по прежнему решению после сборки функциональности, не блокирует разработку. Не выдавать JS bundle за проверенную плавность на устройстве.
