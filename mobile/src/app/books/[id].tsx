import styled from '@emotion/native';
import { formatReadingProgress, type LibraryBookResponse, type ReadingStatus, type ProgressDisplayMode } from '@where-my-books/shared';
import { Alert, Platform, TextInput } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, ErrorState, LoadingState, PillButton, ScreenContainer, ScreenContent, ScreenScroll, SurfaceCard } from '@/components';
import { CoverStylePicker } from '../../features/catalog/CoverStylePicker';
import { UserCoverEditor } from '../../features/catalog/UserCoverEditor';
import { BookCover } from '../../features/catalog/BookCover';
import { BookJournal } from '../../features/journal/BookJournal';
import { ReadingSessionPanel } from '../../features/reading/ReadingSessionPanel';
import { colors, spacing, radii } from '@/theme';
import { api } from '../../api/client';
import { useAuth } from '../../features/auth/AuthProvider';
import { librarySnapshot } from '../../features/offline/library-snapshot';
import { offlineOutbox } from '../../features/offline/outbox';

const Caption = styled.Text({ color: colors.inkSecondary, marginBottom: spacing.sm });
const BackButton = styled.Pressable({ alignSelf: 'flex-start', marginBottom: spacing.sm, padding: spacing.xs });
const BackLabel = styled.Text({ color: colors.inkSecondary });
const StatusRow = styled.View({ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginVertical: spacing.md });
const Field = styled(TextInput)({ borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.sm, marginBottom: spacing.xs });
const statuses: ReadingStatus[] = ['want_to_read', 'reading', 'finished', 'dnf'];
const labels: Record<ReadingStatus, string> = { want_to_read: 'Хочу прочитать', reading: 'Читаю', finished: 'Прочитано', dnf: 'Брошено' };

export default function BookDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const auth = useAuth();
  const [offline, setOffline] = useState(false);
  const initialized = useRef(''); const [mode, setMode] = useState<ProgressDisplayMode>('pages');
  const [book, setBook] = useState<LibraryBookResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    const ownerId = auth.user?.id;
    if (!id || !ownerId) return () => { active = false; };
    void (async () => {
      try {
        const [loaded, settings] = await Promise.all([api.book(id), api.settings()]);
        await librarySnapshot.upsert(ownerId, loaded);
        const [visible] = await offlineOutbox.overlay(ownerId, [loaded]);
        if (!active) return;
        setBook(visible ?? loaded);
        setMode(settings.settings.progressDisplayMode);
        setOffline(false);
        setError(null);
        if (initialized.current !== loaded.id) {
          initialized.current = loaded.id;
          setTitle(loaded.work.title);
          setAuthor(loaded.work.authors.map((item) => item.name).join(', '));
          setTotalPages(String(loaded.progress.totalPages));
        }
      } catch {
        try {
          const snapshot = await librarySnapshot.read(ownerId);
          const cached = snapshot?.books.find(item => item.id === id);
          if (!cached || !active) {
            if (active) setError('Книга недоступна без подключения к серверу');
            return;
          }
          const [visible] = await offlineOutbox.overlay(ownerId, [cached]);
          if (!active) return;
          setBook(visible ?? cached);
          setOffline(true);
          setError(null);
          if (initialized.current !== cached.id) {
            initialized.current = cached.id;
            setTitle(cached.work.title);
            setAuthor(cached.work.authors.map(item => item.name).join(', '));
            setTotalPages(String(cached.progress.totalPages));
          }
        } catch {
          if (active) setError('Не удалось прочитать локальную копию книги');
        }
      }
    })();
    return () => { active = false; };
  }, [id, auth.user?.id]));
  if (error && !book) return <ScreenContainer><ScreenContent><ErrorState message={error} /></ScreenContent></ScreenContainer>;
  if (!book) return <ScreenContainer><ScreenContent><LoadingState /></ScreenContent></ScreenContainer>;
  const run = async (action: () => Promise<LibraryBookResponse | void>) => { setBusy(true); setError(null); try { const updated = await action(); if (updated) setBook(updated); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить изменения'); } finally { setBusy(false); } };
  const queueEdit = async (kind: 'progress' | 'status', value: number | ReadingStatus) => {
    if (!auth.user || Platform.OS === 'web') {
      await run(() => kind === 'progress' ? api.updateProgress(book.id, value as number) : api.updateStatus(book.id, value as ReadingStatus));
      return;
    }
    if (kind === 'progress' && (!Number.isInteger(value) || (value as number) < 0 || (value as number) > book.progress.totalPages)) {
      setError('Укажите страницу в пределах объёма книги');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await librarySnapshot.upsert(auth.user.id, book);
      const operation = {
        operationId: Crypto.randomUUID(), copyId: book.id,
        baseUpdatedAt: book.updatedAt, kind,
        ...(kind === 'progress' ? { currentPage: value as number } : { status: value as ReadingStatus }),
      };
      await offlineOutbox.add(auth.user.id, operation);
      setBook(previous => previous ? {
        ...previous,
        ...(kind === 'status' ? { status: value as ReadingStatus } : {}),
        ...(kind === 'progress' ? { progress: { ...previous.progress, currentPage: value as number } } : {}),
      } : previous);
      const state = await offlineOutbox.flush(auth.user.id);
      setNotice(state.conflicts ? 'Есть конфликт изменений. Проверьте очередь синхронизации.' :
        state.pending ? 'Сохранено на устройстве. Отправим при подключении.' : 'Изменения синхронизированы');
      if (!state.pending && !state.conflicts) {
        const updated = await api.book(book.id);
        setBook(updated);
        await librarySnapshot.upsert(auth.user.id, updated);
        setOffline(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить локальное изменение');
    } finally { setBusy(false); }
  };
  const updatePage = () => { const value = Number(page); if (Number.isInteger(value)) void queueEdit('progress', value); };
  const adjustPage = (delta: number) => void queueEdit('progress', Math.min(book.progress.currentPage + delta, book.progress.totalPages));
  const saveDetails = () => { setNotice(null); void run(async () => { const updated = await api.updateBook(book.id, { title, author, totalPages: totalPages.trim() ? Number(totalPages) : 0 }); setNotice('Изменения сохранены'); return updated; }); };
  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/library'); };
  const remove = () => Alert.alert('Удалить книгу?', 'Книга и её прогресс будут удалены.', [{ text: 'Отмена', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: () => void run(async () => { await api.deleteBook(book.id); router.replace('/(tabs)/library'); }) }]);
  return <ScreenContainer><ScreenScroll><ScreenContent><BackButton accessibilityRole="button" onPress={goBack}><BackLabel>Назад</BackLabel></BackButton>{offline ? <Caption>Офлайн-копия. Сессии и заметки без интернета пока не редактируются.</Caption> : null}<AppHeader title={book.work.title} subtitle={book.work.authors.map((item) => item.name).join(', ')} /><BookCover coverStyle={book.coverStyle} mode={book.coverMode} assetId={book.coverAssetId} uri={book.coverMode === 'automatic' ? book.edition.coverUri : book.coverUri ?? book.edition.coverUri} title={book.work.title} author={book.work.authors.map((a) => a.name).join(", ")} /><CoverStylePicker value={book.coverStyle} title={book.work.title} author={book.work.authors.map((a) => a.name).join('; ')} disabled={busy || imageBusy} onChange={(coverStyle) => void run(() => api.updateBook(book.id, { coverStyle, coverMode: 'placeholder', coverAssetId: null, coverUri: null }))} /><UserCoverEditor disabled={busy || imageBusy} onBusy={setImageBusy} onSelected={(asset) => void run(() => api.updateBook(book.id, { coverMode: 'custom', coverAssetId: asset.id, coverUri: null }))} /><StatusRow><PillButton label="Вернуть автоматическую обложку" variant="secondary" disabled={busy || imageBusy} onPress={() => void run(() => api.updateBook(book.id, { coverMode: 'automatic', coverAssetId: null, coverUri: null }))} /><PillButton label="Типографическая обложка" variant="secondary" disabled={busy || imageBusy} onPress={() => void run(() => api.updateBook(book.id, { coverMode: 'placeholder', coverAssetId: null, coverUri: null }))} /></StatusRow><Caption>{book.edition.isbn ? `ISBN ${book.edition.isbn}` : "ISBN не указан"} · {book.edition.publisher ?? "Издательство не указано"}</Caption><SurfaceCard><Caption>{book.location?.path ?? 'Книга пока вне полок'}</Caption><PillButton label={book.location ? 'Показать место на полке' : 'Разместить на полке'} variant="secondary" disabled={busy || imageBusy} onPress={() => router.push({ pathname: '/shelves', params: { copyId: book.id } })} /></SurfaceCard><SurfaceCard><Caption>{formatReadingProgress(book.progress, mode)} · {labels[book.status]}</Caption><StatusRow>{statuses.map((status) => <PillButton key={status} label={labels[status]} variant={status === book.status ? 'primary' : 'secondary'} disabled={busy} onPress={() => void queueEdit('status', status)} />)}</StatusRow><Caption>Быстрый прогресс</Caption><StatusRow>{[5, 10, 25].map((delta) => <PillButton key={delta} label={`+${delta}`} disabled={busy || book.progress.totalPages <= 0} onPress={() => adjustPage(delta)} />)}</StatusRow><Caption>Текущая страница</Caption><Field value={page} onChangeText={setPage} placeholder={String(book.progress.currentPage)} keyboardType="number-pad" /><PillButton label="Сохранить прогресс" disabled={busy} onPress={updatePage} /></SurfaceCard><SurfaceCard><Caption>Данные книги</Caption><Field value={title} onChangeText={setTitle} placeholder="Название" /><Field value={author} onChangeText={setAuthor} placeholder="Автор" /><Field value={totalPages} onChangeText={setTotalPages} placeholder="Страницы" keyboardType="number-pad" /><PillButton label={busy ? 'Сохраняем…' : 'Сохранить книгу'} disabled={busy || !title.trim() || !author.trim() || Number(totalPages) < 0} onPress={saveDetails} /><PillButton label="Удалить книгу" variant="secondary" disabled={busy} onPress={remove} /></SurfaceCard><ReadingSessionPanel bookId={book.id} currentPage={book.progress.currentPage} totalPages={book.progress.totalPages} onProgressSaved={() => void api.book(book.id).then(setBook).catch(() => {})} /><BookJournal bookId={book.id} totalPages={book.progress.totalPages} />{notice ? <Caption>{notice}</Caption> : null}{error ? <ErrorState message={error} /> : null}</ScreenContent></ScreenScroll></ScreenContainer>;
}
