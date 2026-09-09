import { useMemo, useState } from 'react';
import styled from '@emotion/native';
import type { ProgressDisplayMode } from '@where-my-books/shared';
import { colors, spacing, typography } from '@where-my-books/ui';
import { ScreenContainer, ScreenContent, ScreenScroll } from '@where-my-books/ui/native';
import { VirtualShelfPreview } from '../../features/library/components/VirtualShelfPreview';
import { CurrentReadingCard } from '../../features/reading/components/CurrentReadingCard';
import { initialBooks, type LibraryBookPreview } from '../../features/library/mockBooks';

const Content = styled(ScreenContent)({ gap: spacing.xl });
const HeaderBlock = styled.View({});
const Greeting = styled.Text({ color: colors.inkSecondary, ...typography.label, marginBottom: spacing.xs });
const Hero = styled.Text({ color: colors.ink, ...typography.display, maxWidth: 330 });
const Intro = styled.Text({ color: colors.inkSecondary, ...typography.body, marginTop: spacing.sm, maxWidth: 340 });

export default function HomeScreen() {
  const [books, setBooks] = useState<LibraryBookPreview[]>(initialBooks);
  const [progressMode, setProgressMode] = useState<ProgressDisplayMode>('pages');
  const currentBook = useMemo(() => books.find((book) => book.status === 'reading') ?? books[0], [books]);
  const addPages = (bookId: string, pages: number) => setBooks((currentBooks) => currentBooks.map((book) => book.id === bookId ? { ...book, currentPage: Math.min(book.currentPage + pages, book.totalPages) } : book));
  return <ScreenContainer edges={['top', 'left', 'right']}><ScreenScroll contentContainerStyle={{ paddingBottom: 84 }} showsVerticalScrollIndicator={false}><Content><HeaderBlock><Greeting>BOOKNOOK</Greeting><Hero>Твоя библиотека всегда рядом.</Hero><Intro>Первая живая версия виртуальной полки: прогресс виден прямо на корешках и плавно меняется вместе с чтением.</Intro></HeaderBlock><VirtualShelfPreview books={books} mode={progressMode} onChangeMode={setProgressMode} />{currentBook ? <CurrentReadingCard book={currentBook} progressMode={progressMode} onAddPages={addPages} /> : null}</Content></ScreenScroll></ScreenContainer>;
}
