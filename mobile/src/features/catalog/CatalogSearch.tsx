import { useEffect, useRef, useState } from 'react';
import { Modal } from 'react-native';
import type { CatalogEdition, CatalogSearchHit, CatalogSearchResponse } from '@where-my-books/shared';
import { AppHeader, PillButton, ScreenContainer, ScreenContent, ScreenScroll } from '@/components';
import { api } from '../../api/client';
import { useAuth } from '../auth/AuthProvider';
import { BookCover } from './BookCover';
import { Choice, Field, Note, Row } from './styles';
type Copies = CatalogSearchResponse['hits'][number]['existingCopies'];
export function CatalogSearch(props: Parameters<typeof CatalogSearchForAccount>[0]) {
  const { user } = useAuth();
  return <CatalogSearchForAccount key={user?.id ?? 'guest'} {...props} />;
}
function CatalogSearchForAccount({ disabled, onActivity, onText, onIsbn, onEdition, onCopy }: { disabled: boolean; onActivity: () => void; onText: (hit: CatalogSearchHit) => void; onIsbn: (isbn: string) => void; onEdition: (edition: CatalogEdition, copies: Copies) => void; onCopy: (id: string) => void }) {
  const [visible, setVisible] = useState(false); const [title, setTitle] = useState(''); const [author, setAuthor] = useState('');
  const [result, setResult] = useState<CatalogSearchResponse>(); const [expanded, setExpanded] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const close = () => { abort.current?.abort(); setBusy(false); setVisible(false); };
  const change = (action: () => void) => { abort.current?.abort(); setBusy(false); setResult(undefined); setError(''); action(); };
  const search = async (page = 1) => {
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    setBusy(true); setError(''); setResult(undefined); setExpanded('');
    try { const response = await api.catalogSearch({ title, author, page }, controller.signal); if (!controller.signal.aborted) setResult(response); }
    catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Каталог недоступен. Повторите поиск или заполните карточку вручную.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <><PillButton label="Найти по названию и автору" variant="secondary" disabled={disabled} onPress={() => { onActivity(); setVisible(true); }} />
    <Modal visible={visible} animationType="none" onRequestClose={close}><ScreenContainer><ScreenScroll keyboardShouldPersistTaps="handled"><ScreenContent>
      <AppHeader title="Поиск в каталоге" subtitle="Название, автор или оба поля" />
      <Field accessibilityLabel="Название для поиска в каталоге" placeholder="Название книги" maxLength={200} value={title} onChangeText={(value) => change(() => setTitle(value))} />
      <Field accessibilityLabel="Автор для поиска в каталоге" placeholder="Автор" maxLength={200} value={author} onChangeText={(value) => change(() => setAuthor(value))} />
      <PillButton label={busy ? 'Ищем…' : 'Найти / повторить поиск'} disabled={busy || (title.trim().length < 2 && author.trim().length < 2)} onPress={() => void search()} />
      <Note numberOfLines={1} accessibilityRole={error ? 'alert' : 'text'} accessibilityLabel={error || 'Название и автор до 200 символов'}>{error || 'Название и автор до 200 символов'}</Note>
      {result?.unavailableSources.length ? <Note>Часть каталогов недоступна: {result.unavailableSources.join(', ')}. Можно повторить поиск.</Note> : null}
      {result && !result.hits.length ? <Note>Ничего не найдено. Уточните название/автора или закройте поиск и создайте карточку вручную.</Note> : null}
      {result?.hits.map((hit) => {
        const key = `${hit.source}:${hit.externalId}`;
        return <Choice key={key}><Note>{hit.title} · {hit.authors.join('; ') || 'Автор не указан'} · {hit.source}</Note><Note>{hit.kind === 'work' ? 'Произведение: издание нужно выбрать по ISBN' : 'Каталожное издание'}</Note>
          {hit.edition ? <><BookCover uri={hit.edition.covers[0]?.uri} title={hit.title} author={hit.authors.join('; ')} /><Note>{hit.edition.publisher ?? 'Издательство не указано'} · {hit.edition.publicationYear ?? 'Год не указан'} · ISBN {hit.edition.isbn}</Note><PillButton label="Выбрать это издание" onPress={() => { close(); onEdition(hit.edition!, hit.existingCopies); }} /></> : null}
          {hit.existingCopies.map((copy) => <PillButton key={copy.id} label={`Уже в библиотеке: ${copy.title}`} variant="secondary" onPress={() => { close(); onCopy(copy.id); }} />)}
          <PillButton label="Перенести только название и авторов" variant="secondary" onPress={() => { close(); onText(hit); }} />
          {hit.isbns.length && !hit.edition ? <><PillButton label={expanded === key ? 'Скрыть ISBN изданий' : 'Выбрать ISBN издания'} variant="secondary" onPress={() => setExpanded(expanded === key ? '' : key)} />{expanded === key ? <><Note>Сверьте ISBN своей книги. Показано до 12 ISBN; обложка и сведения загрузятся после выбора.</Note><Row>{hit.isbns.map((isbn) => <PillButton key={isbn} label={isbn} variant="secondary" onPress={() => { close(); onIsbn(isbn); }} />)}</Row></> : null}</> : null}
        </Choice>;
      })}
      {result ? <Row><PillButton label="Предыдущие результаты" variant="secondary" disabled={busy || result.page <= 1} onPress={() => void search(result.page - 1)} /><Note>Страница {result.page}</Note><PillButton label="Следующие результаты" variant="secondary" disabled={busy || !result.hasMore} onPress={() => void search(result.page + 1)} /></Row> : null}
      <PillButton label="Вернуться к карточке" variant="secondary" onPress={close} />
    </ScreenContent></ScreenScroll></ScreenContainer></Modal></>;
}
