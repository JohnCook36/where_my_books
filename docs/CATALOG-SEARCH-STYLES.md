# Title/author fallback и типографические обложки — C

## Поиск

Из формы добавления и review можно открыть модальный поиск по названию, автору либо обоим полям. Поиск явный: ввод не расходует запросы на каждую букву. Есть загрузка, отмена при изменении запроса/закрытии, retry, пустой список, недоступные источники и предыдущая/следующая страница. Смена аккаунта очищает результаты и отменяет запрос.

`GET /api/catalog/search?title=...&author=...&page=1` требует авторизацию. Оба текста до 200 символов, хотя бы один от двух символов; page1–20. Каждый источник возвращает до10 результатов на страницу. Google Books использует volume/intitle/inauthor; OpenLibrary search — work-level title/author. Метаданные нормализуются в BookMetadataProvider.search; общий provider cache не содержит личных данных. Запросы coalesced, cache5min/100pages только для непустого полного успеха, общий с ISBN concurrency8, фиксированные HTTPS origins/no redirects, timeout6s (OpenLibrary search10s)/2MB response. ISBN и текстовый поиск используют общий per-user лимит30/мин на instance; distributed quota/backoff остаются production работой.

Ответ содержит source/externalId/kind/title/authors/valid canonical ISBNs; Google volume с валидным ISBN также normalized edition. OpenLibrary work не получает ни обложку, ни сведения конкретного издания из произвольной work-level записи. До12 ISBN произведения предлагаются для явного выбора: существующий exact ISBN lookup возвращает метаданные и обложки выбранного издания. Каталог не заявляется исчерпывающим перечислением всех изданий произведения.

Пользователь может перенести только название/авторов — без чужого ISBN, издательства и обложки. Это работает для неизвестного ISBN и книг без ISBN; остальные поля редактируются вручную. Google edition можно применить непосредственно, не выполняя повторную загрузку. После выбора в ручном добавлении ISBN меняется явно. В review исходный scanned ISBN неизменяем: другое издание открывается отдельным добавлением после подтверждения и сохранения текущего черновика. Ошибка сохранения оставляет пользователя на исходной форме; не обходит CAS или guard.

Для найденных ISBN сервер добавляет `existingCopies` только текущего пользователя после чтения provider cache; чужие IDs/названия не попадают в cache или ответ другого аккаунта. Найденную copy можно открыть, либо добавить ещё один экземпляр.

## Заглушки

Четыре per-copy пресета coverStyle: parchment, forest, burgundy, midnight. Палитры и визуальные значения — в `ui` tokens. Типографическая обложка показывает название/автора и полосу корешка. Полный текст доступен как accessibility label. Выбор стиля явно включает placeholder, очищает ссылку на пользовательскую картинку; стиль сохраняется и применяется также при ошибке изображения.

Поле coverStyle проходит runtime enum validation в create/update/review. Additive migration задаёт parchment существующим copies, не удаляя metadata/cover assets/предыдущие миграции. Cover-only PATCH не создаёт новую Edition. Настройка независима у нескольких copies одного издания. Review payload сохраняет стиль до batch confirmation, а после перезапуска стиль восстанавливается в форме и библиотеке.

## Проверки и границы

Unit: work/edition trust boundary, ISBN checksum/dedup, query encoding, page offset, missing ISBN, cache/coalescing/outage и private match decoration. PostgreSQL/HTTP suite проверяет route/auth/validation/page1–2/owner matches, сохранение normalized search edition, idempotent create, enum rejection, independent styles/edition identity, persisted draft/restart/confirm.

HTTP integration использует изолированный test-only `--import` preload для ответов двух внешних API. В production нет fixture переключателя; auth, HTTP, Prisma, PostgreSQL и миграции настоящие. Внешняя доступность не делает CI случайным. Отдельные live probes запускаются production provider кодом; результаты фиксируются в Notion и PR. Наличие fixtures не является доказательством live success.

Ручной Android по решению владельца отложен до сборки функциональности приложения. Native UI, back gesture, TalkBack/VoiceOver и крупный шрифт ещё требуют приёмки. Общая полка партии, полный Real Shelf, storage retention/backup и дальнейшие D–I остаются в roadmap.

Live probe 2026-10-16: production OpenLibraryProvider.search вернул10 work hits и hasMore=true для Fantastic Mr Fox / Roald Dahl; первый /works/OL45804W с12нормализованными ISBN candidates. Исходный fixed API endpoint вернул20works/10docs за7757ms, что обосновывает10s search timeout. Google Books в той же среде ответил429; его live-success остаётся открытым.
