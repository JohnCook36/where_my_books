# Сохранённые черновики и подтверждение партии — 2026-10-16

Продолжение этапа C в том же функциональном draft PR #1. Это расширение текущей серверной очереди, не самостоятельная offline-библиотека.

## Пользовательский сценарий

1. Отсканировать несколько ISBN и открыть очередь.
2. Открыть книгу: существующий snapshot восстанавливается с сервера. Он не заменяется новым ответом каталога. Для повторного каталожного поиска есть отдельная кнопка.
3. Исправить название/авторов/страницы, выбрать обложку.
4. «Сохранить черновик» сохраняет неполную форму; «Подтвердить для партии» проверяет название/автора и отмечает её готовой. Книга ещё не считается принадлежащим пользователю экземпляром.
5. Несохранённые изменения показываются явно; выход с такими изменениями требует решения пользователя. Это native navigation guard из того же контекста, который использует установленный Expo Router 57; изолированный адаптер не добавляет вторую navigation-библиотеку.
6. В очереди «Сохранить все подтверждённые» обрабатывает только отмеченные готовыми записи. Каждая книга получает отдельный результат и ссылку на сохранённый экземпляр. Непроверенные, конфликтующие и неуспешные записи остаются в очереди.
7. При потерянном ответе кнопка повторяет проверку той же партии. Сервер использует draft UUID как ключ операции; подтверждённые записи возвращают прежний copyId.

Введённые, но ещё не сохранённые правки не объявляются сохранёнными. При force close до отправки формы гарантируется последняя подтверждённая серверная версия, не каждый локальный символ. Offline outbox не внедряется без sync protocol.

## API

- `GET /api/scan-drafts`: приватная очередь, включая payload/reviewed/revision/updatedAt.
- `GET /api/scan-drafts/:id`: собственный snapshot, чужие IDs возвращают 404.
- `PATCH /api/scan-drafts/:id`: `{ baseRevision, reviewed, payload }`. payload допускает частичные title/author/totalPages и прежние metadata/cover поля. ISBN — неизменная identity сканирования, другой ISBN требует другого draft. Title/author нужны для reviewed=true, неизвестные страницы разрешены.
- Stale baseRevision → 409 без перезаписи. Повтор той же PATCH после потери ответа возвращает прежний snapshot без дополнительной ревизии.
- `POST /api/scan-drafts/confirm`: `{ items: [{ id, revision }] }`, 1–50 уникальных IDs. Возвращает `{ results }`; каждая запись — saved/copyId либо invalid/conflict/not_found/failed/message. Один отказ не отменяет остальные.
- Прямой POST книги не может обойти проверку ревизии уже сохранённого review payload; для него используется confirm endpoint. Старый ISBN-only сценарий остаётся совместим.

## Целостность

Для editing/delete/direct create/confirmation применяется один advisory transaction lock на userId+operationId. Проверка ревизии и создание work/edition/copy с удалением draft выполняются в одной PostgreSQL-транзакции. Повтор после commit использует owned BookCopy.clientRequestId как receipt. Ключ и receipt всегда scoped по userId; чужая выдача не возвращает copyId. Партия — последовательность отдельных коротких транзакций, а не одна общая транзакция на 50 книг.

Additive migration `20261016000002_scan_review_payload` сохраняет старые ISBN-only drafts как unreviewed с revision=0. Никакие прежние migration/ID не переписываются. Shared contracts расширены совместимо с новым API.

## Автоматические проверки

Types/lint/unit/server build, Android export и Expo Doctor. Расширенный PostgreSQL HTTP suite проверяет:

- частичный snapshot и выбранную обложку после перезапуска API;
- PATCH replay, stale revision и nested validation;
- owner isolation для чтения/правки/receipt;
- mixed batch: conflict + unreviewed + saved;
- concurrent/repeated confirmation: тот же copyId и без новых копий;
- реальную ошибку CHECK constraint в PostgreSQL после создания metadata, rollback work/edition и успешное сохранение соседней записи;
- повтор failed записи после устранения DB-сбоя.

Фактические CI run/commit/results фиксируются в PR и Notion Development Log. Код тестов сам по себе не означает, что они прошли.

## Остаётся открытым

Общая полка зависит от D; собственные фотографии/crop/rotate/reset и CoverAsset policy — следующий блок C. Физический Android (scanner, back gesture, large fonts, TalkBack) и iOS UX ещё требуют ручной приёмки. Успешный поиск в живом внешнем каталоге не подменяется тестовыми metadata.

## Подтверждённые результаты

Backend revision `73606e1e9d37d8a1dcaa9dda203d57fdcf6ac254`: [PR CI 38829528333](https://github.com/JohnCook36/where_my_books/actions/runs/38829528333) success. Проверены install/types/lint/60 unit tests, миграция и весь расширенный PostgreSQL/HTTP suite, включая реальный CHECK constraint failure, отсутствие orphan work/edition и повтор failed записи. Regression runtime DTO учитывает унаследованный ISBN=undefined.

Локально Expo Doctor 21/21 и Android production JS export прошли. Последующая UI review-правка отменяет незавершённый lookup при ручном редактировании и удерживает экран во время save; её итоговый commit/CI фиксируется в Notion и PR. Ни bundle, ни API tests не заменяют real-device navigation/scanner acceptance.
