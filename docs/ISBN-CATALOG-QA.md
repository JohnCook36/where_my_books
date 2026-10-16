# ISBN / каталог / обложки: первый поставляемый блок C

## Входит
- Shared ISBN10/13 checksum, 978/979, ISBN10→13 canonical key.
- BookMetadataProvider, Google Books + Open Library; exact ISBN matching, source/externalId, metadata snapshot.
- Ограниченные provider responses (2 MB), 6s timeout, no redirects, fixed origins, bounded in-flight/cache, per-user lookup limit. Внешние изображения только HTTPS supported catalog hosts; нет server image proxy произвольных URL.
- Выбор обложки среди кандидатов совпавшего ISBN, preview и fallback при image error. Сохраняется override копии; не зависит от будущего ответа каталога.
- Atomic work/edition/copy create, UUID clientRequestId, concurrent replay returns same copy; дополнительная copy может явно ссылаться на собственное editionId. Персональная правка создаёт отдельный snapshot, не меняя остальные copies.
- expo-camera совместимой версии 57: EAN13, frame, continuous autofocus (autofocus off в Expo API), torch, permission/settings, mount error/retry, foreground/focus lifecycle, haptics, callback suppression.
- Серверная очередь ISBN до 50; canonical dedup, resume после перезапуска/входа; отдельное подтверждение каждой книги. Ключ сохранения = draft UUID. Copy и удаление соответствующего draft выполняются атомарно; при повторе POST новая copy не создаётся, изменённый payload с тем же ключом получает 409.
- Unknown page count: 0 означает «неизвестно», а не выдуманный объём; добавление не блокируется. Shared подпись «Объём не указан», быстрый прирост disabled до ввода объёма. Расширенная audio-модель — следующий блок.

## Не завершено (не включать в Done этапа C)
- Общая полка для партии — зависит от серверной модели размещения D. Bulk review и подтверждение всех реализованы следующим срезом, см. SCAN-BATCH-REVIEW.md.
- Ручная приёмка восстановления/редактирования черновиков и batch UX на устройстве (API/реализация добавлены следующим срезом).
- Private photo/gallery upload, MIME/file-size checks, crop/rotate/cancel/reset-auto и cover source asset policy.
- Выбор физического места — зависит от D: серверной модели размещения ещё нет.
- Поиск по названию/автору внешнего каталога, automatic backoff и production-wide distributed quota.
- Настоящий Android, iOS и пользовательская UX-приёмка.

## Запуск
Сохраняйте существующие app IDs, scheme и имена пакетов. Новые native-модули камеры/crypto требуют development build (`npm run android`) после установки зависимостей, простой restart Metro старый APK не обновляет.

1. `npm ci` (shared runtime собирается postinstall, Prisma генерируется).
2. `server/.env` на основе `.env.example`, PostgreSQL.
3. `npm run prisma:deploy --workspace @where-my-books/server`.
4. `npm run build --workspace @where-my-books/shared` и `npm run build --workspace @where-my-books/server`.
5. `npm run start --workspace @where-my-books/server`.
6. Для USB Android: `adb reverse tcp:3000 tcp:3000`; `EXPO_PUBLIC_API_URL=http://127.0.0.1:3000/api`; новый Android development build.

Google Books production key задаётся только `GOOGLE_BOOKS_API_KEY` на backend. Без выделенной квоты возможен 429; ручная карточка работает независимо. Реальные обращения из среды разработки: Google 429, Open Library timeout. Это фиксирует ограничение среды/API, не подтверждает успешное получение реальных metadata.

## Автоматика
- `npm run typecheck`, `npm run lint`, `npm run test`.
- `cd mobile && npx expo-doctor`.
- `cd mobile && npx expo export --platform android` (проверяет bundle, не работу камеры).
- На disposable PostgreSQL: `WMB_INTEGRATION_TEST=1 DATABASE_URL=... npm run test:integration --workspace @where-my-books/server` после migrate deploy. Тест создаёт отдельные аккаунты и удаляет их; не запускать на production. В CI отдельный PostgreSQL17 service.

## Ручная приёмка на Android (ещё не выполнена)
- [ ] Модель, Android, build SHA записаны.
- [ ] Разрешение: allow/deny/не спрашивать/settings.
- [ ] EAN13 978/979: autofocus/torch/haptics; другие EAN не принимаются.
- [ ] Двойной callback одного кода создаёт один draft.
- [ ] 10–50 книг: queue сохраняется после force close, login и network outage.
- [ ] Provider success: верное издание, источник, обложка, title/author/pages и manual correction.
- [ ] Existing ISBN: открыть copy или явное добавление второй.
- [ ] Сохранить→library→details→restart: ISBN/cover/progress не теряются.
- [ ] Unknown/429/timeout: понятный retry/manual path.
- [ ] Недоступная картинка: типографическая заглушка, не broken rectangle.
- [ ] Background и возврат: камера не работает за другим экраном.
- [ ] TalkBack/large fonts/Reduce Motion и navigation.

DoD требует green CI + реальные сценарии; написанный код и bundle сами по себе не финальная приёмка.

## Продолжение C: пакетная проверка
[Сохранённые черновики, ревизии и партия](SCAN-BATCH-REVIEW.md): additive payload/reviewed/revision/updatedAt, восстановление формы, PATCH/CAS и replay, подтверждение готовности, confirm-all и отчёт, независимые транзакции, сохранение/возобновление после сбоя.
