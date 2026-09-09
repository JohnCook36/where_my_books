import { useMemo, useState } from 'react';
import styled from '@emotion/native';
import { colors, spacing } from '@where-my-books/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VirtualShelfPreview } from '../features/library/components/VirtualShelfPreview';
import {
  initialBooks,
  type LibraryBookPreview,
} from '../features/library/mockBooks';
import { CurrentReadingCard } from '../features/reading/components/CurrentReadingCard';

const Screen = styled(SafeAreaView)({
  backgroundColor: colors.canvas,
  flex: 1,
});

const Scroll = styled.ScrollView.attrs({
  contentContainerStyle: {
    paddingBottom: 56,
  },
  showsVerticalScrollIndicator: false,
})({
  flex: 1,
});

const Content = styled.View({
  gap: spacing.xl,
  paddingHorizontal: 20,
  paddingTop: spacing.lg,
});

const Greeting = styled.Text({
  color: colors.inkSecondary,
  fontSize: 13,
  fontWeight: '700',
  marginBottom: spacing.xs,
});

const Hero = styled.Text({
  color: colors.ink,
  fontFamily: 'serif',
  fontSize: 34,
  fontWeight: '700',
  lineHeight: 40,
  maxWidth: 330,
});

const Intro = styled.Text({
  color: colors.inkSecondary,
  fontSize: 14,
  lineHeight: 22,
  marginTop: spacing.sm,
  maxWidth: 340,
});

export default function HomeScreen() {
  const [books, setBooks] = useState<LibraryBookPreview[]>(initialBooks);

  const currentBook = useMemo(
    () => books.find((book) => book.status === 'reading') ?? books[0],
    [books],
  );

  const addPages = (bookId: string, pages: number) => {
    setBooks((currentBooks) =>
      currentBooks.map((book) =>
        book.id === bookId
          ? {
              ...book,
              currentPage: Math.min(book.currentPage + pages, book.totalPages),
            }
          : book,
      ),
    );
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Scroll>
        <Content>
          <styled.View>
            <Greeting>BOOKNOOK</Greeting>
            <Hero>Твоя библиотека всегда рядом.</Hero>
            <Intro>
              Первая живая версия виртуальной полки: прогресс виден прямо на
              корешках и плавно меняется вместе с чтением.
            </Intro>
          </styled.View>

          <VirtualShelfPreview books={books} />

          {currentBook ? (
            <CurrentReadingCard book={currentBook} onAddPages={addPages} />
          ) : null}
        </Content>
      </Scroll>
    </Screen>
  );
}
