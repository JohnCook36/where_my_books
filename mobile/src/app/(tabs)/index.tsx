import { useCallback, useMemo, useState } from 'react';
import styled from '@emotion/native';
import type { ProgressDisplayMode } from '@where-my-books/shared';
import { colors, spacing, typography } from '@where-my-books/ui';
import { EmptyState, ErrorState, LoadingState, ScreenContainer, ScreenContent, ScreenScroll } from '@where-my-books/ui/native';
import { VirtualShelfPreview } from '../../features/library/components/VirtualShelfPreview';
import { CurrentReadingCard } from '../../features/reading/components/CurrentReadingCard';
import type { LibraryBookPreview } from '../../features/library/types';
import { useAuth } from '../../features/auth/AuthProvider';
import { api } from '../../api/client';
import { Redirect, useFocusEffect } from 'expo-router';

const Content = styled(ScreenContent)({ gap: spacing.xl });
const HeaderBlock = styled.View({});
const Greeting = styled.Text({ color: colors.inkSecondary, ...typography.label, marginBottom: spacing.xs });
const Hero = styled.Text({ color: colors.ink, ...typography.display, maxWidth: 330 });
const Intro = styled.Text({ color: colors.inkSecondary, ...typography.body, marginTop: spacing.sm, maxWidth: 340 });

export default function HomeScreen() {
  const auth = useAuth();
  const [books, setBooks] = useState<LibraryBookPreview[]>([]);
  const [progressMode, setProgressMode] = useState<ProgressDisplayMode>('pages');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentBook = useMemo(() => books.find((book) => book.status === 'reading') ?? books[0], [books]);
  const load = useCallback(async () => {
    if (!auth.user) return;
    setLoading(true); setError(null);
    try {
      const [{ books: loaded }, { settings }] = await Promise.all([api.books(), api.settings()]);
      setBooks(loaded.map((book) => ({ id: book.id, title: book.work.title, author: book.work.authors.map((author) => author.name).join(', '), status: book.status, currentPage: book.progress.currentPage, totalPages: book.progress.totalPages, spineColor: book.spineColor, spineWidth: book.spineWidth, spineHeight: book.spineHeight })));
      setProgressMode(settings.progressDisplayMode);
    } catch (err) { setError(err instanceof Error ? err.message : 'Ошибка загрузки'); }
    finally { setLoading(false); }
  }, [auth.user]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const addPages = async (bookId: string, pages: number) => {
    const book = books.find((item) => item.id === bookId);
    if (!book) return;
    try { const updated = await api.updateProgress(bookId, Math.min(book.currentPage + pages, book.totalPages)); setBooks((current) => current.map((item) => item.id === bookId ? { ...item, currentPage: updated.progress.currentPage } : item)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить прогресс'); }
  };
  const changeMode = async (mode: ProgressDisplayMode) => { setProgressMode(mode); try { await api.updateSettings(mode); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить настройку'); } };
  if (!auth.user) return <Redirect href="/auth/login" />;
  return <ScreenContainer edges={['top', 'left', 'right']}><ScreenScroll contentContainerStyle={{ paddingBottom: 84 }} showsVerticalScrollIndicator={false}><Content><HeaderBlock><Greeting>BOOKNOOK</Greeting><Hero>Твоя библиотека всегда рядом.</Hero><Intro>Прогресс синхронизируется с твоей библиотекой.</Intro></HeaderBlock>{loading ? <LoadingState /> : error ? <ErrorState message={error} /> : books.length === 0 ? <EmptyState title="Библиотека пока пуста" message="Добавь первую книгу во вкладке «Добавить»." /> : <><VirtualShelfPreview books={books} mode={progressMode} onChangeMode={changeMode} />{currentBook ? <CurrentReadingCard book={currentBook} progressMode={progressMode} onAddPages={addPages} /> : null}</>}</Content></ScreenScroll></ScreenContainer>;
}
