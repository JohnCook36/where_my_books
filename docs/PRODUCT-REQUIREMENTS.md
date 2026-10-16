# WhereMyBook — требования владельца, 2026-10-16

Источник: MASTER PROMPT — WHERE MY BOOK, сообщение владельца от 2026-10-16. Этот документ — структурированная фиксация требований; оригинальное сообщение остаётся исходным текстом. Новые предложения записываются отдельно с датой, без молчаливого изменения решений.

## 1. Назначение и границы
Полноценное приложение Android, iOS и Web для покупки, учёта, хранения, чтения и обсуждения книг. Основное отличие — цифровой двойник реальной домашней библиотеки. Коллекции от 20 до нескольких тысяч экземпляров. MVP — промежуточная поставка, не конец продукта. Репозиторий JohnCook36/where_my_books, исторические имена WhereMyBooks/BookNook. Пакеты и app IDs без отдельного решения не переименовывать.

## 2. UX и навигация
Уютный книжный интерфейс: качественные обложки и пропорциональные корешки, типографика, microinteractions, haptics, плавные анимации, светлая/тёмная/системная тема, малые/большие экраны. Moodboard не является pixel specification. Reduce Motion обязателен. Long press поднимает книгу, DnD раздвигает соседей, карточка раскрывается, прогресс плавно заполняется, цель завершается спокойно. Анимации не блокируют UI.
Пять вкладок: Главная, Библиотека, Добавить, Статистика, Профиль; внутренние экраны — stack. Главная: приветствие, сейчас читаю, обложка/автор/название, прогресс/остаток, +5/+10/+25, шкаф, новые и недавно прочитанные книги, цель, активность, позже рекомендации. Без перегруза второстепенными метриками.

## 3. Книги и модель
Author → BookWork → Edition → BookCopy; несколько авторов, изданий и независимых копий. Бумага/ebook/audio. Владение отдельно от чтения: want_to_read, planned, reading, paused, finished, dnf, rereading. Прочитанная книга может больше не принадлежать пользователю.
Карточка: название/альтернативное/оригинальное, авторы, описание, обложка, ISBN10/13, издательство/год, серия/номер, жанры, язык оригинала/издания, переводчик, страницы, формат/переплёт/размеры, тип копии, состояние, приобретение (дата/цена/валюта/источник), теги, комментарии, рейтинг, статус, место, история прогресса. Не все поля обязательны. Ручная правка каталожных данных, личные overrides не изменяют чужие данные.

## 4. ISBN и камера — обязательный ближайший приоритет
Добавить → камера → EAN13 (978/979) → checksum → поиск издания → metadata и обложки → корректировка → место → сохранение → немедленная видимость в библиотеке и после перезапуска. ISBN10 (X) и ISBN13 валидируются; прочие коды не считаются ISBN. Автофокус, фонарик, рамка, haptics, suppression повторных callbacks, ручной ISBN, retry, denial/settings, unknown/invalid/no network, последовательное добавление.
Массовый режим 10–50: сохраняемая очередь, исправление неуверенных данных, счётчик, дедуп сканирований, общий шкаф/полка, подтверждение и сохранение корректных записей, изолированные ошибки, сохранность подтверждённого после закрытия. Повторный физический экземпляр разрешён отдельным явным действием; повтор callback/request не создаёт дубль.
BookMetadataProvider: Google Books + Open Library fallback/корректное объединение, source/externalId, собственная нормализованная модель. Limits, cache, retries, timeout, названия/русские/иностранные книги, work vs edition, отсутствующие поля, разные ISBN, условия metadata/images. Пользовательские данные не зависят от доступности провайдера. Unknown: retry, title/author, manual ISBN, другое издание, собственная карточка/обложка — добавление не блокируется каталогом.

## 5. Обложки
Первой — соответствующая изданию. Кандидаты Google/OpenLibrary/другие законные источники, галерея пользователя, фото, встроенная заглушка. Сетка миниатюр и полноразмерный preview; выбор/поздняя замена/crop/выравнивание/rotate/cancel/reset-auto. Override конкретной копии. Не подменять издание совпавшим произведением.
Заглушка: название/автор/тема/настраиваемый фон/корешок. Нет сломанных изображений. Хранить source URL, source, override, размеры/оптимизацию, cache policy, broken URL fallback. Upload size/MIME/format validation. Не копировать без разрешения чужие images в публичный storage; SSRF защита.

## 6. Физическая библиотека и прогресс на корешках
Комната/зона → шкаф → секция → полка → позиция. Одна текущая позиция на физическую копию; ebook/audio без места. Названия, размеры, материалы/темы/цвета, порядок, подписи, число секций/полок. 2D/2.5D, без тяжёлой 3D игры. Корешок: название, автор по месту, цвет/толщина/высота, прогресс; размеры реальные либо приблизительные с ручной коррекцией.
DnD/long press, перенос между шкафами, порядок/автосортировка/свободное место, карточка, подсветка поиска, Undo и доступный перенос без DnD. Серверное сохранение. Удаление шкафа переносит книги, не удаляет их. Real Shelf точно воспроизводит место. Поиск показывает полный путь и подсветку. Режимы: обложки/список/корешки/шкаф.
Читаемые корешки: полупрозрачная заливка, не закрывающая текст; единый глобальный режим проценты/страницы. Детали: текущая/всего/процент/остаток/история. Unknown pages корректно, audio — время.

## 7. Чтение и дневник
Начать/продолжить/пауза/завершить/перечитать; ручной прогресс/+5/+10/+25/Undo; даты; история. Нельзя превысить total без исправления объёма. ReadingSession: начало/конец/длительность/страницы/темп/книга/заметка. Таймер переживает background и допускает ручную коррекцию.
ReadingNote/BookQuote: текст, страница, глава, впечатления, оценка, дата, теги, spoiler, поиск. Приватные заметки отдельно от публичных Review.

## 8. Поиск, коллекции, серии
Своя библиотека отдельно от внешнего каталога и рекомендаций. Название/автор/ISBN/серия/жанр/издательство/теги/место. Фильтры: формат/статус/автор/жанр/серия/язык/год/шкаф/полка/оценка/наличие/избранное. Сортировка: название/автор/добавление/покупка/завершение/рейтинг/серия/год. Уже в библиотеке → открыть копию или добавить ещё одну.
Избранное, хочу купить, хочу прочитать, сейчас читаю, прочитано, отложено, свои коллекции, авторы/серии/жанры; недостающие тома. Wishlist не увеличивает владение. После покупки — перенос в библиотеку.

## 9. Статистика и цели
В собственности/прочитано/читаю/планы, страницы/время, месяцы/годы, жанры/авторы/средняя оценка/темп/объём/пополнение. Цели: книги за год, страницы за месяц, минуты за день/неделю, индивидуальная. Достижения и streak без наказания. Понятные графики.

## 10. Выдача
Конкретная копия/человек/дата/ожидаемый возврат/комментарий/возврат. Отдельный экран книг у других, добровольные напоминания, без требования регистрации получателя. Приватные контакты/выдачи.

## 11. Социальное и рекомендации
После стабилизации личного учёта: профили/друзья/подписки/публичные отзывы/рекомендации/открытые и совместные подборки/обсуждения/рекомендовать другу. Приватность default; профиль private/public, видимость коллекций, публичность отзывов, скрытые заметки/цены/покупки/место. Модерация/жалобы/блокировки.
Объяснимые рекомендации по жанрам/книгам/оценкам/авторам/wishlist/интересам/похожести. Объяснение причины и скрытие нерелевантного. LLM только при измеримой необходимости.

## 12. Последующие согласованные улучшения
CSV/JSON, при необходимости XLSX: preview, dedup, errors, safe retry; импорт других сервисов лишь через доступный законный экспорт. Версионированный backup/export и restore с проверкой сохранности. Семейная библиотека: общие шкафы/коллекции/владельцы/права, явное разделение данных. OCR фото полки — R&D, только подтверждённые результаты. Виджет, добровольные уведомления, поиск без отдельного экрана, recent actions/Undo, batch tags/place, RU first/EN-ready, гибкая приватность.

## 13. Архитектура и безопасность
Sibling workspaces mobile/client/server/ui/shared. Expo/RN/TS/Router/Emotion/Reanimated/Gesture/Haptics, совместимая камера; фактическая версия 57 проверяется. Nest/TS/Postgres/Prisma/REST/DTO/runtime validation/migrations. Web React/TS/Vite/Emotion; не Next.js. Shared domain/contracts/validation/pure rules; UI tokens/type/spacing/motion/переиспользуемые компоненты с платформенными реализациями.
Сохранить Author, BookWork, Edition, BookCopy, ReadingStatus, ReadingProgress, Shelf, ShelfSection, ShelfPlacement, ProgressDisplayMode, UserSettings. По сценарию добавить User/Session/CoverAsset/CatalogSource/ReadingSession/ProgressHistory/ReadingNote/BookQuote/Review/Collection/CollectionItem/ReadingGoal/BookLoan/WishlistItem/ImportJob/ActivityEvent, не таблицы ради диаграммы.
Версионность, recovery/delete, идемпотентность и owner checks. PostgreSQL истина, независимого SQLite-first нет. Offline лишь после протокола: client/server IDs, revisions/conflicts/outbox/retry/tombstones/cursors/multi-device/recovery.
Register/login/recovery/access-refresh/secure storage/logout/device sessions/privacy/delete account/export. Server entity ownership; rate limit/validation/uploads/SSRF/image limits/no secrets/safe migrations/backup+restore/redacted logs. Public permission model отдельно.

## 14. Производительность и доступность
Средний Android: плавность/virtualized lists/image thumbnails/cache/pagination/request cancellation/slow network/background recovery/эффективные шкафы. TalkBack/VoiceOver/contrast/large fonts/touch targets/Reduce Motion/text alternatives/no mandatory DnD. Большой шрифт не ломает layout.

## 15. Карта экранов
Auth: welcome/register/login/recovery. Home: dashboard/current/quick progress. Library: catalog/grid/list/shelves. Shelves: all/cabinet/section/edit/move. Books: details/edit/edition/history. Add: methods/camera/search/manual. Scan: scanner/queue/confirm/errors. Covers: candidates/preview/photo/crop. Reading: session/progress/history/journal. Notes: list/quotes/create/edit. Collections: personal/wishlist/series. Stats: overview/goals/year/history. Loans: list/new/return. Social: friends/public/reviews/recommendations. Profile: personal/privacy/theme/settings. Data: import/export/sync/account. Реальные действия и loading/empty/error/confirm; никаких кнопок-заглушек.

## 16. Этапы и управление
A аудит → B stable library → C scanner/catalog/covers → D virtual → E journal/stats → F collections/loans/import → G sync/Web → H social → I release. Сохранять ранее завершённые этапы. C раньше social.
Notion: отдельный единственный Development HQ, overview/full requirements/architecture/roadmap/task board/decision log/dev log/bugs/QA/UI. Поля задач и views согласно заданию; после логического блока обновить статусы/коммиты/PR/CI/tests/bugs/next. GitHub код, Notion управление, ROADMAP версионируемый план. При недоступности — локальный Markdown, без ложного заявления о создании.
Один PR на логический блок, не множество мелких; никаких force/reset/потери migrations/пользовательских изменений. Не менять CI/production ради runner. Не merge red checks. Общие tokens, без fake user data, обоснованные зависимости.

## 17. Приёмка и DoD
1 ISBN→camera→backend→edition→cover→save→restart. 2 Unknown→manual→save. 3 Existing ISBN→open or new independent copy, no double callback duplicate. 4 Cabinet/section/shelf/place/reorder/restart/search. 5 Current/+10/server/spine/global mode. 6 A/B owner isolation including direct API. 7 Bulk/dedup/confirm/persist/isolated errors. 8 Covers/select/persist/own photo/relogin/broken URL. 9 API down/retry/no loss.
Камера: обязательный настоящий Android. Typecheck/lint/unit/API/migration/E2E/Expo Doctor/build по значимости. При failure сначала минимальный тест; полный gate после блока. Длительная проверка не означает успех; безопасная независимая работа продолжается.
DoD: logic+UI+API+error states+tests+regression+green CI+docs+Notion+scenario evidence. Техническая готовность отдельно от пользовательской приёмки. Отчёт: реализовано/проверено/GitHub/Notion/проблемы/следующий блок.
