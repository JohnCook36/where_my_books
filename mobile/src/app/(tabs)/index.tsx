import { useMemo } from 'react';
import styled from '@emotion/native';
import { colors, spacing, typography } from '@where-my-books/ui';
import { EmptyState, ErrorState, LoadingState, ScreenContainer, ScreenContent, ScreenScroll } from '@where-my-books/ui/native';
import { VirtualShelfPreview } from '../../features/library/components/VirtualShelfPreview';
import { CurrentReadingCard } from '../../features/reading/components/CurrentReadingCard';
import { useLibraryBooks } from '../../features/library/hooks/useLibraryBooks';
import { useProgressDisplayMode } from '../../db';

const Content = styled(ScreenContent)({ gap: spacing.xl });
const HeaderBlock = styled.View({});
const Greeting = styled.Text({ color: colors.inkSecondary, ...typography.label, marginBottom: spacing.xs });
const Hero = styled.Text({ color: colors.ink, ...typography.display, maxWidth: 330 });
const Intro = styled.Text({ color: colors.inkSecondary, ...typography.body, marginTop: spacing.sm, maxWidth: 340 });

export default function HomeScreen() {
  const { books, addPages, error, isLoading } = useLibraryBooks();
  const { mode: progressMode, updateMode: setProgressMode } = useProgressDisplayMode();
  const currentBook = useMemo(() => books.find((book) => book.status === 'reading') ?? books[0], [books]);
  if (isLoading) return <ScreenContainer><LoadingState /></ScreenContainer>;
  if (error) return <ScreenContainer><ErrorState message={error.message} /></ScreenContainer>;
  if (books.length === 0) return <ScreenContainer><EmptyState title="Библиотека пуста" /></ScreenContainer>;
  return <ScreenContainer edges={['top', 'left', 'right']}><ScreenScroll contentContainerStyle={{ paddingBottom: 84 }} showsVerticalScrollIndicator={false}><Content><HeaderBlock><Greeting>BOOKNOOK</Greeting><Hero>Твоя библиотека всегда рядом.</Hero><Intro>Первая живая версия виртуальной полки: прогресс виден прямо на корешках и плавно меняется вместе с чтением.</Intro></HeaderBlock><VirtualShelfPreview books={books} mode={progressMode} onChangeMode={setProgressMode} />{currentBook ? <CurrentReadingCard book={currentBook} progressMode={progressMode} onAddPages={addPages} /> : null}</Content></ScreenScroll></ScreenContainer>;
}
