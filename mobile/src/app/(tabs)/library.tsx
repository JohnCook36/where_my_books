import styled from '@emotion/native';
import { formatReadingProgress, type LibraryBookResponse, type LibrarySearchSort, type ProgressDisplayMode, type ReadingStatus, type SearchBooksResponse } from '@where-my-books/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, TextInput } from 'react-native';
import { AppHeader, EmptyState, ErrorState, LoadingState, PillButton, ScreenContainer, ScreenContent, ScreenScroll, SurfaceCard } from '@/components';
import { colors, radii, spacing, typography } from '@/theme';
import { api } from '../../api/client';
import { BookCover } from '../../features/catalog/BookCover';
import { useAuth } from '../../features/auth/AuthProvider';
import { filterCachedBooks, librarySnapshot } from '../../features/offline/library-snapshot';
import { offlineOutbox, type OutboxStatus } from '../../features/offline/outbox';

const Title = styled.Text({ color: colors.ink, ...typography.heading });
const Meta = styled.Text({ color: colors.inkSecondary, ...typography.caption, marginTop: spacing.xs });
const List = styled.View({ gap: spacing.sm, marginTop: spacing.lg });
const Filters = styled.View({ gap: spacing.sm, marginTop: spacing.md });
const Options = styled.View({ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs });
const SearchField = styled(TextInput)({ color: colors.ink, backgroundColor: colors.paper, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, ...typography.body });
const statusOptions: { status?: ReadingStatus; label: string }[] = [
  { label: 'Все' },
  { status: 'want_to_read', label: 'Хочу прочитать' },
  { status: 'reading', label: 'Читаю' },
  { status: 'finished', label: 'Прочитано' },
  { status: 'dnf', label: 'Брошено' },
];
const sortOptions: { value: LibrarySearchSort; label: string }[] = [
  { value: 'added', label: 'Добавление' },
  { value: 'title', label: 'Название' },
  { value: 'year', label: 'Год' },
  { value: 'updated', label: 'Изменение' },
];
const empty: SearchBooksResponse = { books: [], total: 0, page: 1, limit: 20, hasMore: false };

export default function LibraryScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [result, setResult] = useState<SearchBooksResponse>(empty);
  const [mode, setMode] = useState<ProgressDisplayMode>('pages');
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ReadingStatus | undefined>();
  const [sort, setSort] = useState<LibrarySearchSort>('added');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [queue, setQueue] = useState<OutboxStatus>({ pending: 0, conflicts: 0 });

  const load = useCallback(() => {
    if (!auth.user) return;
    let active = true;
    setLoading(true);
    setError(null);
    const ownerId = auth.user.id;
    const filters = { query, ...(status ? { status } : {}), sort, order, page, limit: 20 };
    void (async () => {
      try {
        const state = await offlineOutbox.flush(ownerId);
        if (active) setQueue(state);
        const [data, settings, snapshot] = await Promise.all([
          api.searchBooks(filters),
          api.settings(),
          api.syncBootstrap(),
        ]);
        const visible = await offlineOutbox.overlay(ownerId, data.books);
        if (!active) return;
        setResult({ ...data, books: visible });
        setMode(settings.settings.progressDisplayMode);
        setCachedAt(null);
        await librarySnapshot.save(ownerId, snapshot.books);
      } catch {
        try {
          const snapshot = await librarySnapshot.read(ownerId);
          if (!active) return;
          if (snapshot) {
            const visible = await offlineOutbox.overlay(ownerId, snapshot.books);
            if (!active) return;
            setResult(filterCachedBooks(visible, filters));
            setCachedAt(snapshot.savedAt);
            setError(null);
          } else {
            setError('Не удалось загрузить библиотеку. Нет доступного локального снимка.');
          }
        } catch {
          if (active) setError('Не удалось прочитать локальные данные.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [auth.user, query, status, sort, order, page, reload]);

  useFocusEffect(load);

  const applyQuery = () => {
    setQuery(draftQuery.trim());
    setPage(1);
    setReload((current) => current + 1);
  };
  const changeStatus = (value: ReadingStatus | undefined) => { setStatus(value); setPage(1); };
  const changeSort = (value: LibrarySearchSort) => { setSort(value); setPage(1); };
  if (auth.loading) return <ScreenContainer><LoadingState /></ScreenContainer>;
  if (!auth.user) return null;
  const hasFilters = !!query || !!status;
  return <ScreenContainer>
    <ScreenScroll keyboardShouldPersistTaps="handled">
      <ScreenContent>
        <AppHeader title="Библиотека" subtitle={`${result.total} книг найдено`} />
        {queue.pending || queue.conflicts ? <Meta>Локальные изменения: ожидают отправки {queue.pending}, требуют решения {queue.conflicts}</Meta> : null}
        {queue.pending ? <PillButton label="Повторить синхронизацию" variant="secondary" onPress={() => setReload(value => value + 1)} /> : null}
        {queue.conflicts && auth.user ? <PillButton label="Отменить конфликтующие локальные правки" variant="secondary" onPress={() => Alert.alert('Удалить конфликтующие правки?', 'Изменения, которые сервер не принял, будут удалены с этого устройства. Серверные данные останутся без изменений.', [
          { text: 'Назад', style: 'cancel' },
          { text: 'Удалить локальные правки', style: 'destructive', onPress: () => void offlineOutbox.discardConflicts(auth.user!.id).then(() => setReload(value => value + 1)).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Не удалось очистить конфликт')) },
        ])} /> : null}
        {cachedAt ? <Meta>Офлайн-копия от {new Date(cachedAt).toLocaleString()}. Изменения без интернета пока недоступны.</Meta> : null}
        <PillButton label="Мои шкафы и расположение книг" variant="secondary" onPress={() => router.push('/shelves')} />
        <Filters>
          <SearchField
            value={draftQuery}
            onChangeText={setDraftQuery}
            onSubmitEditing={applyQuery}
            returnKeyType="search"
            placeholder="Название, автор, ISBN, издательство"
            placeholderTextColor={colors.inkMuted}
            accessibilityLabel="Поиск по личной библиотеке"
          />
          <Options>
            <PillButton label="Найти" onPress={applyQuery} />
            {(query || draftQuery) ? <PillButton label="Сбросить поиск" variant="secondary" onPress={() => { setDraftQuery(''); setQuery(''); setPage(1); setReload((v) => v + 1); }} /> : null}
          </Options>
          <Meta>Статус чтения</Meta>
          <Options>
            {statusOptions.map((option) => <PillButton key={option.status ?? 'all'} label={option.label} variant={status === option.status ? 'primary' : 'secondary'} onPress={() => changeStatus(option.status)} />)}
          </Options>
          <Meta>Сортировка</Meta>
          <Options>
            {sortOptions.map((option) => <PillButton key={option.value} label={option.label} variant={sort === option.value ? 'primary' : 'secondary'} onPress={() => changeSort(option.value)} />)}
          </Options>
          <PillButton label={order === 'asc' ? 'Порядок: по возрастанию' : 'Порядок: по убыванию'} variant="secondary" onPress={() => { setOrder((v) => v === 'asc' ? 'desc' : 'asc'); setPage(1); }} />
        </Filters>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : result.books.length === 0
          ? <EmptyState title={hasFilters ? 'Ничего не найдено' : 'Библиотека пока пуста'} message={hasFilters ? 'Измените запрос или фильтр чтения.' : 'Отсканируйте ISBN или добавьте книгу вручную.'} />
          : <List>
              {result.books.map((book: LibraryBookResponse) => <Pressable key={book.id} onPress={() => router.push(`/books/${book.id}`)}>
                <SurfaceCard>
                  <BookCover coverStyle={book.coverStyle} mode={book.coverMode} assetId={book.coverAssetId} uri={book.coverMode === 'automatic' ? book.edition.coverUri : book.coverUri ?? book.edition.coverUri} title={book.work.title} />
                  <Title>{book.work.title}</Title>
                  <Meta>{book.work.authors.map((author) => author.name).join(', ')} · {formatReadingProgress(book.progress, mode)}</Meta>
                  {book.location ? <Meta>{book.location.path}</Meta> : null}
                </SurfaceCard>
              </Pressable>)}
            </List>}
        {!loading && !error && result.total > result.limit ? <Options>
          <PillButton label="Назад" variant="secondary" disabled={page <= 1} onPress={() => setPage((current) => Math.max(1, current - 1))} />
          <Meta>Страница {page} / {Math.ceil(result.total / result.limit)}</Meta>
          <PillButton label="Дальше" variant="secondary" disabled={!result.hasMore} onPress={() => setPage((current) => current + 1)} />
        </Options> : null}
      </ScreenContent>
    </ScreenScroll>
  </ScreenContainer>;
}
