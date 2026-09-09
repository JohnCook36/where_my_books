import styled from '@emotion/native';
import type { LibraryBookResponse, ReadingStatus } from '@where-my-books/shared';
import { Alert, TextInput } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, ErrorState, LoadingState, PillButton, ScreenContainer, ScreenContent, ScreenScroll, SurfaceCard } from '@where-my-books/ui/native';
import { api } from '../../api/client';

const Caption = styled.Text({ color: '#66706B', marginBottom: 12 });
const StatusRow = styled.View({ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 16 });
const Field = styled(TextInput)({ borderColor: '#D5D9D3', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 });
const statuses: ReadingStatus[] = ['want_to_read', 'reading', 'finished', 'dnf'];
const labels: Record<ReadingStatus, string> = { want_to_read: 'Хочу прочитать', reading: 'Читаю', finished: 'Прочитано', dnf: 'Брошено' };

export default function BookDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<LibraryBookResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');

  useEffect(() => { if (id) void api.book(id).then((loaded) => { setBook(loaded); setTitle(loaded.work.title); setAuthor(loaded.work.authors.map((item) => item.name).join(', ')); setTotalPages(String(loaded.progress.totalPages)); }).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Ошибка загрузки')); }, [id]);
  if (error) return <ScreenContainer><ScreenContent><ErrorState message={error} /></ScreenContent></ScreenContainer>;
  if (!book) return <ScreenContainer><ScreenContent><LoadingState /></ScreenContent></ScreenContainer>;
  const run = async (action: () => Promise<LibraryBookResponse | void>) => { setBusy(true); setError(null); try { const updated = await action(); if (updated) setBook(updated); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить изменения'); } finally { setBusy(false); } };
  const updatePage = () => { const value = Number(page); if (!Number.isInteger(value)) return; void run(() => api.updateProgress(book.id, value)); };
  const adjustPage = (delta: number) => void run(() => api.updateProgress(book.id, Math.min(book.progress.currentPage + delta, book.progress.totalPages)));
  const saveDetails = () => void run(() => api.updateBook(book.id, { title, author, totalPages: Number(totalPages) }));
  const remove = () => Alert.alert('Удалить книгу?', 'Книга и её прогресс будут удалены.', [{ text: 'Отмена', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: () => void run(async () => { await api.deleteBook(book.id); router.replace('/(tabs)/library'); }) }]);
  return <ScreenContainer><ScreenScroll><ScreenContent><AppHeader back title={book.work.title} subtitle={book.work.authors.map((item) => item.name).join(', ')} /><SurfaceCard><Caption>{book.progress.currentPage} / {book.progress.totalPages} страниц · {labels[book.status]}</Caption><StatusRow>{statuses.map((status) => <PillButton key={status} label={labels[status]} variant={status === book.status ? 'primary' : 'secondary'} disabled={busy} onPress={() => void run(() => api.updateStatus(book.id, status))} />)}</StatusRow><Caption>Быстрый прогресс</Caption><StatusRow>{[5, 10, 25].map((delta) => <PillButton key={delta} label={`+${delta}`} disabled={busy} onPress={() => adjustPage(delta)} />)}</StatusRow><Caption>Текущая страница</Caption><Field value={page} onChangeText={setPage} placeholder={String(book.progress.currentPage)} keyboardType="number-pad" /><PillButton label="Сохранить прогресс" disabled={busy} onPress={updatePage} /></SurfaceCard><SurfaceCard><Caption>Данные книги</Caption><Field value={title} onChangeText={setTitle} placeholder="Название" /><Field value={author} onChangeText={setAuthor} placeholder="Автор" /><Field value={totalPages} onChangeText={setTotalPages} placeholder="Страницы" keyboardType="number-pad" /><PillButton label={busy ? 'Сохраняем…' : 'Сохранить книгу'} disabled={busy || !title.trim() || !author.trim() || Number(totalPages) < 1} onPress={saveDetails} /><PillButton label="Удалить книгу" variant="secondary" disabled={busy} onPress={remove} /></SurfaceCard>{error ? <ErrorState message={error} /> : null}</ScreenContent></ScreenScroll></ScreenContainer>;
}
