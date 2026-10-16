import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { Alert, Modal } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { CatalogEdition, CatalogLookupResponse, CreateBookRequest, ScanDraft, ScanDraftPayload, ConfirmScanDraftItem } from '@where-my-books/shared';
import { isbn13 } from '@where-my-books/shared';
import { AppHeader, PillButton, ScreenContainer, ScreenContent, ScreenScroll } from '@/components';
import { api, ApiError } from '../../api/client';
import { useReviewNavigationGuard } from './useReviewNavigationGuard';
import { BookCover } from './BookCover';
import { Choice, Field, Note, PreviewImage, Row } from './styles';

export function AddBookScreen({ initialIsbn = '', initialDraft, onReloadDraft }: { initialIsbn?: string; initialDraft?: ScanDraft; onReloadDraft?: () => void }) {
  const draftId = initialDraft?.id;
  const router = useRouter();
  const [isbn, setIsbn] = useState(initialIsbn);
  const [result, setResult] = useState<CatalogLookupResponse>();
  const [selected, setSelected] = useState<CatalogEdition>();
  const [title, setTitle] = useState(initialDraft?.payload?.title ?? ''); const [author, setAuthor] = useState(initialDraft?.payload?.author ?? ''); const [pages, setPages] = useState(initialDraft?.payload?.totalPages ? String(initialDraft.payload.totalPages) : '');
  const [cover, setCover] = useState<string | undefined>(initialDraft?.payload?.coverUri ?? undefined); const [preview, setPreview] = useState<string>();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [searching, setSearching] = useState(!!initialIsbn && !initialDraft?.payload);
  const [metadata, setMetadata] = useState<ScanDraftPayload>(initialDraft?.payload ?? {});
  const [revision, setRevision] = useState(initialDraft?.revision ?? 0);
  const [dirty, setDirty] = useState(false); const [conflict, setConflict] = useState(false);
  const [draftNotice, setDraftNotice] = useState(initialDraft?.reviewed ? 'Подтверждено для партии' : initialDraft?.payload ? 'Черновик сохранён на сервере' : '');
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmScanDraftItem | null>(null);
  const bypassLeave = useRef(false);
  const [saved, setSaved] = useState<string>();
  // Kept across ambiguous failures. Retrying this operation never creates another copy.
  const requestId = useRef(draftId ?? Crypto.randomUUID());
  const abort = useRef<AbortController | null>(null);
  const completed = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!completed.current || draftId) return;
    completed.current = false; requestId.current = Crypto.randomUUID();
    setSaved(undefined); setIsbn(''); setTitle(''); setAuthor(''); setPages('');
    setResult(undefined); setSelected(undefined); setCover(undefined); setError('');
    setMetadata({}); setDirty(false); setPendingConfirmation(null); setConflict(false); setDraftNotice(''); bypassLeave.current = false;
  }, [draftId]));
  useReviewNavigationGuard(!!draftId && dirty, bypassLeave);
  const edit = (action: () => void) => { action(); setDirty(true); setDraftNotice('Есть несохранённые правки'); };
  const select = (edition: CatalogEdition) => { setDirty(true); setDraftNotice('Проверьте данные и сохраните черновик'); setMetadata({ ...(edition.publisher ? { publisher: edition.publisher } : {}), ...(edition.publicationYear ? { publicationYear: edition.publicationYear } : {}), ...(edition.language ? { language: edition.language } : {}), ...(edition.description ? { description: edition.description } : {}), catalogSource: edition.source, externalId: edition.externalId }); setSelected(edition); setTitle(edition.title); setAuthor(edition.authors.join('; ')); setPages(edition.pageCount ? String(edition.pageCount) : ''); setCover(edition.covers[0]?.uri); };
  const lookup = async (value: string) => {
    const normalized = isbn13(value);
    if (!normalized) { setError('Это не ISBN книги. Проверьте цифры или заполните карточку вручную.'); return; }
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    setSearching(true); setError(''); setResult(undefined); setSelected(undefined);
    try { const data = await api.catalog(normalized, controller.signal); if (controller.signal.aborted) return; setResult(data); if (data.editions[0]) select(data.editions[0]); }
    catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Каталог недоступен. Можно добавить книгу вручную.'); }
    finally { if (!controller.signal.aborted) setSearching(false); }
  };
  useEffect(() => {
    const normalized = isbn13(initialIsbn); if (!normalized || initialDraft?.payload) return;
    const controller = new AbortController(); abort.current = controller;
    void api.catalog(normalized, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setResult(data); if (data.editions[0]) select(data.editions[0]);
    }).catch((err: unknown) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Каталог недоступен. Заполните карточку вручную.'); })
      .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    return () => controller.abort();
  }, [initialIsbn, initialDraft?.payload]);

  const coverCandidates = selected ? [...new Map([
    ...selected.covers,
    ...(result?.editions.filter((edition) => edition.isbn === selected.isbn).flatMap((edition) => edition.covers) ?? []),
  ].map((candidate) => [candidate.uri, candidate])).values()] : [];

  const formPayload = (): ScanDraftPayload => {
    const totalPages = pages.trim() ? Number(pages) : 0;
    if (!/^\d*$/.test(pages.trim()) || !Number.isSafeInteger(totalPages) || totalPages > 100000) throw new Error('Страницы: целое число от 0 до 100000; неизвестное можно оставить пустым.');
    return { ...metadata, title: title.trim(), author: author.trim(), authors: author.split(';').map((name) => name.trim()).filter(Boolean), totalPages, coverUri: cover ?? null };
  };
  const handleError = (err: unknown) => {
    if (err instanceof ApiError && (err.status === 409 || err.status === 404)) setConflict(true);
    setError(err instanceof Error ? err.message : 'Не удалось сохранить. Повторите запрос.');
  };
  const persistDraft = async (reviewed: boolean) => {
    if (!draftId) throw new Error('Черновик не загружен');
    const updated = await api.updateScanDraft(draftId, { baseRevision: revision, reviewed, payload: formPayload() });
    setRevision(updated.revision); setDirty(false); setConflict(false);
    setDraftNotice(reviewed ? 'Подтверждено для партии и сохранено на сервере' : 'Черновик сохранён на сервере');
    return updated;
  };
  const saveDraft = async (reviewed: boolean) => {
    setBusy(true); setError('');
    try { await persistDraft(reviewed); } catch (err) { handleError(err); } finally { setBusy(false); }
  };
  const submit = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      let copyId: string;
      if (draftId) {
        let item = pendingConfirmation;
        if (!item) {
          const draft = await persistDraft(true);
          item = { id: draft.id, revision: draft.revision }; setPendingConfirmation(item);
        }
        const result = (await api.confirmScanDrafts([item])).results[0];
        if (!result || result.status !== 'saved') {
          setPendingConfirmation(null);
          if (result?.status === 'conflict' || result?.status === 'not_found') setConflict(true);
          throw new Error(result ? result.message : 'Не получен результат подтверждения. Повторите запрос.');
        }
        copyId = result.copyId;
      } else {
        const payload = formPayload();
        if (!payload.title || !payload.author) throw new Error('Укажите название и автора.');
        const normalized = isbn.trim() ? isbn13(isbn) : undefined;
        if (isbn.trim() && !normalized) throw new Error('Исправьте ISBN или очистите поле для ручного добавления.');
        const request: CreateBookRequest = { ...payload, title: payload.title, author: payload.author, totalPages: payload.totalPages ?? 0, clientRequestId: requestId.current, ...(normalized ? { isbn: normalized } : {}) };
        copyId = (await api.addBook(request)).id;
      }
      completed.current = true; bypassLeave.current = true; setDirty(false); setSaved(copyId);
      router.replace(`/books/${copyId}`);
    } catch (err) { handleError(err); } finally { setBusy(false); }
  };
  const disabled = busy || !!saved || !!pendingConfirmation;
  return <ScreenContainer><ScreenScroll keyboardShouldPersistTaps="handled"><ScreenContent>
    {draftId ? <PillButton label="Назад к очереди" variant="secondary" onPress={() => router.back()} /> : null}
    <AppHeader title="Добавить книгу" subtitle="Сканируйте ISBN или заполните карточку" />
    {!draftId ? <Row><PillButton label="Сканировать книгу" onPress={() => router.push('/scan')} /><PillButton label="Массовое сканирование" variant="secondary" onPress={() => router.push('/scan?bulk=1')} /><PillButton label="Очередь сканирования" variant="secondary" onPress={() => router.push('/scan/queue')} /></Row> : null}
    <Field accessibilityLabel="ISBN" value={isbn} onChangeText={(value) => { abort.current?.abort(); setSearching(false); setIsbn(value); setMetadata({}); setDirty(true); setSelected(undefined); setResult(undefined); setCover(undefined); }} placeholder="ISBN-10 или ISBN-13" editable={!disabled && !draftId} autoCapitalize="characters" />
    <PillButton label={searching ? 'Ищем издание…' : 'Найти по ISBN / повторить'} disabled={searching || disabled} onPress={() => void lookup(isbn)} />
    {result?.unavailableSources.length ? <Note>Часть каталогов недоступна: {result.unavailableSources.join(', ')}. Повторите поиск или заполните поля вручную.</Note> : null}
    {result && !result.editions.length ? <Note>Издание не найдено. Можно заполнить карточку ниже и сохранить без каталога.</Note> : null}
    {result?.existingCopies.length ? <><Note>Уже есть в вашей библиотеке. Можно открыть экземпляр или сохранить ещё один:</Note>{result.existingCopies.map((copy) => <PillButton key={copy.id} label={copy.title} variant="secondary" onPress={() => router.push(`/books/${copy.id}`)} />)}</> : null}
    {result?.editions.map((edition) => <Choice key={`${edition.source}:${edition.externalId}`} accessibilityRole="button" accessibilityState={{ selected: selected === edition }} disabled={disabled} onPress={() => select(edition)}><Note>{selected === edition ? '✓ ' : ''}{edition.title} · {edition.publisher ?? 'Издательство не указано'} · {edition.publicationYear ?? 'Год неизвестен'} · {edition.source}</Note></Choice>)}
    <Field accessibilityLabel="Название книги" placeholder="Название" value={title} onChangeText={(value) => edit(() => setTitle(value))} editable={!disabled} />
    <Field accessibilityLabel="Авторы через точку с запятой" placeholder="Автор; второй автор" value={author} onChangeText={(value) => edit(() => setAuthor(value))} editable={!disabled} />
    <Field accessibilityLabel="Количество страниц, можно оставить пустым" placeholder="Страницы, если известны" keyboardType="number-pad" value={pages} onChangeText={(value) => edit(() => setPages(value))} editable={!disabled} />
    {initialDraft?.payload && cover ? <BookCover uri={cover} title={title} author={author} /> : null}
    <Note>Выберите обложку текущего издания</Note>
    <Row>{coverCandidates.map((candidate) => <Choice key={candidate.uri} accessibilityRole="button" accessibilityLabel={`Выбрать обложку ${candidate.source}`} accessibilityState={{ selected: cover === candidate.uri }} disabled={disabled} onPress={() => edit(() => setCover(candidate.uri))} onLongPress={() => setPreview(candidate.uri)}><BookCover uri={candidate.uri} title={title} author={author} /><Note>{candidate.source}{cover === candidate.uri ? ' · выбрана' : ''}</Note></Choice>)}<Choice accessibilityRole="button" accessibilityLabel="Типографическая обложка" accessibilityState={{ selected: !cover }} disabled={disabled} onPress={() => edit(() => setCover(undefined))}><BookCover title={title} author={author} /><Note>Без внешнего изображения</Note></Choice></Row>
    {cover ? <PillButton label="Предпросмотр обложки" variant="secondary" onPress={() => setPreview(cover)} /> : null}
    {draftId ? <><Note accessibilityLiveRegion="polite">{draftNotice}</Note><Row><PillButton label="Сохранить черновик" disabled={disabled || searching || conflict} variant="secondary" onPress={() => void saveDraft(false)} /><PillButton label="Подтвердить для партии" disabled={disabled || searching || conflict} onPress={() => void saveDraft(true)} /></Row></> : null}
    {conflict && onReloadDraft ? <PillButton label="Загрузить серверную версию" variant="secondary" onPress={() => Alert.alert('Загрузить серверную версию?', 'Несохранённые правки будут заменены актуальными данными.', [{ text: 'Отмена', style: 'cancel' }, { text: 'Загрузить', onPress: onReloadDraft }])} /> : null}
    <Note accessibilityRole="alert" accessibilityLiveRegion="polite">{error || (saved ? 'Книга сохранена. Повторное сохранение безопасно.' : 'Неизвестное количество страниц можно оставить пустым.')}</Note>
    <PillButton label={busy ? 'Сохраняем…' : saved ? 'Открыть сохранённую книгу' : pendingConfirmation ? 'Повторить подтверждение книги' : 'Подтвердить и сохранить экземпляр'} disabled={busy || searching || conflict} onPress={() => saved ? router.replace(`/books/${saved}`) : void submit()} />
    <Modal visible={!!preview} onRequestClose={() => setPreview(undefined)} animationType="none"><ScreenContainer><ScreenContent>{preview ? <PreviewImage source={{ uri: preview }} resizeMode="contain" onError={() => { setPreview(undefined); setError('Изображение недоступно. Выберите другую обложку или заглушку.'); }} /> : null}<PillButton label="Закрыть предпросмотр" onPress={() => setPreview(undefined)} /></ScreenContent></ScreenContainer></Modal>
  </ScreenContent></ScreenScroll></ScreenContainer>;
}
