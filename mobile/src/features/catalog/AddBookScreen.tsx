import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { Modal } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { CatalogEdition, CatalogLookupResponse, CreateBookRequest } from '@where-my-books/shared';
import { isbn13 } from '@where-my-books/shared';
import { AppHeader, PillButton, ScreenContainer, ScreenContent, ScreenScroll } from '@/components';
import { api } from '../../api/client';
import { BookCover } from './BookCover';
import { Choice, Field, Note, PreviewImage, Row } from './styles';

export function AddBookScreen({ initialIsbn = '', draftId }: { initialIsbn?: string; draftId?: string | undefined }) {
  const router = useRouter();
  const [isbn, setIsbn] = useState(initialIsbn);
  const [result, setResult] = useState<CatalogLookupResponse>();
  const [selected, setSelected] = useState<CatalogEdition>();
  const [title, setTitle] = useState(''); const [author, setAuthor] = useState(''); const [pages, setPages] = useState('');
  const [cover, setCover] = useState<string>(); const [preview, setPreview] = useState<string>();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [searching, setSearching] = useState(!!initialIsbn);
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
  }, [draftId]));
  const select = (edition: CatalogEdition) => { setSelected(edition); setTitle(edition.title); setAuthor(edition.authors.join('; ')); setPages(edition.pageCount ? String(edition.pageCount) : ''); setCover(edition.covers[0]?.uri); };
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
    const normalized = isbn13(initialIsbn); if (!normalized) return;
    const controller = new AbortController(); abort.current = controller;
    void api.catalog(normalized, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setResult(data); if (data.editions[0]) select(data.editions[0]);
    }).catch((err: unknown) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Каталог недоступен. Заполните карточку вручную.'); })
      .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    return () => controller.abort();
  }, [initialIsbn]);

  const coverCandidates = selected ? [...new Map([
    ...selected.covers,
    ...(result?.editions.filter((edition) => edition.isbn === selected.isbn).flatMap((edition) => edition.covers) ?? []),
  ].map((candidate) => [candidate.uri, candidate])).values()] : [];

  const submit = async () => {
    if (busy) return;
    const totalPages = pages.trim() ? Number(pages) : 0;
    if (!title.trim() || !author.trim()) { setError('Укажите название и автора.'); return; }
    if (!/^\d*$/.test(pages.trim()) || !Number.isSafeInteger(totalPages) || totalPages > 100000) { setError('Страницы: целое число от 0 до 100000; неизвестное можно оставить пустым.'); return; }
    const normalized = isbn.trim() ? isbn13(isbn) : undefined;
    if (isbn.trim() && !normalized) { setError('Исправьте ISBN или очистите поле для ручного добавления.'); return; }
    setBusy(true); setError('');
    try {
      const payload: CreateBookRequest = { title: title.trim(), author: author.trim(), authors: author.split(';').map((a) => a.trim()).filter(Boolean), totalPages, clientRequestId: requestId.current, ...(normalized ? { isbn: normalized } : {}), ...(cover ? { coverUri: cover } : {}) };
      if (selected && selected.isbn === normalized) Object.assign(payload, { publisher: selected.publisher, publicationYear: selected.publicationYear, language: selected.language, description: selected.description, catalogSource: selected.source, externalId: selected.externalId });
      const book = await api.addBook(payload); completed.current = true; setSaved(book.id);
      router.replace(`/books/${book.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить. Повторите запрос.'); }
    finally { setBusy(false); }
  };
  return <ScreenContainer><ScreenScroll keyboardShouldPersistTaps="handled"><ScreenContent>
    {draftId ? <PillButton label="Назад к очереди" variant="secondary" onPress={() => router.back()} /> : null}
    <AppHeader title="Добавить книгу" subtitle="Сканируйте ISBN или заполните карточку" />
    {!draftId ? <Row><PillButton label="Сканировать книгу" onPress={() => router.push('/scan')} /><PillButton label="Массовое сканирование" variant="secondary" onPress={() => router.push('/scan?bulk=1')} /><PillButton label="Очередь сканирования" variant="secondary" onPress={() => router.push('/scan/queue')} /></Row> : null}
    <Field accessibilityLabel="ISBN" value={isbn} onChangeText={(value) => { abort.current?.abort(); setSearching(false); setIsbn(value); setSelected(undefined); setResult(undefined); setCover(undefined); }} placeholder="ISBN-10 или ISBN-13" editable={!busy && !saved} autoCapitalize="characters" />
    <PillButton label={searching ? 'Ищем издание…' : 'Найти по ISBN / повторить'} disabled={searching || busy || !!saved} onPress={() => void lookup(isbn)} />
    {result?.unavailableSources.length ? <Note>Часть каталогов недоступна: {result.unavailableSources.join(', ')}. Повторите поиск или заполните поля вручную.</Note> : null}
    {result && !result.editions.length ? <Note>Издание не найдено. Можно заполнить карточку ниже и сохранить без каталога.</Note> : null}
    {result?.existingCopies.length ? <><Note>Уже есть в вашей библиотеке. Можно открыть экземпляр или сохранить ещё один:</Note>{result.existingCopies.map((copy) => <PillButton key={copy.id} label={copy.title} variant="secondary" onPress={() => router.push(`/books/${copy.id}`)} />)}</> : null}
    {result?.editions.map((edition) => <Choice key={`${edition.source}:${edition.externalId}`} accessibilityRole="button" accessibilityState={{ selected: selected === edition }} onPress={() => select(edition)}><Note>{selected === edition ? '✓ ' : ''}{edition.title} · {edition.publisher ?? 'Издательство не указано'} · {edition.publicationYear ?? 'Год неизвестен'} · {edition.source}</Note></Choice>)}
    <Field accessibilityLabel="Название книги" placeholder="Название" value={title} onChangeText={setTitle} editable={!busy && !saved} />
    <Field accessibilityLabel="Авторы через точку с запятой" placeholder="Автор; второй автор" value={author} onChangeText={setAuthor} editable={!busy && !saved} />
    <Field accessibilityLabel="Количество страниц, можно оставить пустым" placeholder="Страницы, если известны" keyboardType="number-pad" value={pages} onChangeText={setPages} editable={!busy && !saved} />
    <Note>Выберите обложку текущего издания</Note>
    <Row>{coverCandidates.map((candidate) => <Choice key={candidate.uri} accessibilityRole="button" accessibilityLabel={`Выбрать обложку ${candidate.source}`} accessibilityState={{ selected: cover === candidate.uri }} onPress={() => setCover(candidate.uri)} onLongPress={() => setPreview(candidate.uri)}><BookCover uri={candidate.uri} title={title} author={author} /><Note>{candidate.source}{cover === candidate.uri ? ' · выбрана' : ''}</Note></Choice>)}<Choice accessibilityRole="button" accessibilityLabel="Типографическая обложка" accessibilityState={{ selected: !cover }} onPress={() => setCover(undefined)}><BookCover title={title} author={author} /><Note>Без внешнего изображения</Note></Choice></Row>
    {cover ? <PillButton label="Предпросмотр обложки" variant="secondary" onPress={() => setPreview(cover)} /> : null}
    <Note accessibilityRole="alert" accessibilityLiveRegion="polite">{error || (saved ? 'Книга сохранена. Повторное сохранение безопасно.' : 'Неизвестное количество страниц можно оставить пустым.')}</Note>
    <PillButton label={busy ? 'Сохраняем…' : saved ? 'Открыть сохранённую книгу' : 'Подтвердить и сохранить экземпляр'} disabled={busy || searching} onPress={() => saved ? router.replace(`/books/${saved}`) : void submit()} />
    <Modal visible={!!preview} onRequestClose={() => setPreview(undefined)} animationType="none"><ScreenContainer><ScreenContent>{preview ? <PreviewImage source={{ uri: preview }} resizeMode="contain" onError={() => { setPreview(undefined); setError('Изображение недоступно. Выберите другую обложку или заглушку.'); }} /> : null}<PillButton label="Закрыть предпросмотр" onPress={() => setPreview(undefined)} /></ScreenContent></ScreenContainer></Modal>
  </ScreenContent></ScreenScroll></ScreenContainer>;
}
