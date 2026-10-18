import { useMemo, useState } from 'react';
import styled from '@emotion/native';
import {
  formatReadingProgress,
  getReadingProgressRatio,
  type ProgressDisplayMode,
} from '@where-my-books/shared';
import { BookSpine, SegmentedControl } from '@/components';
import { colors, radii, spacing } from '@/theme';
import * as Haptics from 'expo-haptics';
import { ScrollView } from 'react-native';

import type { LibraryBookPreview } from '../types';

interface VirtualShelfPreviewProps {
  books: LibraryBookPreview[];
  mode: ProgressDisplayMode;
  onChangeMode: (mode: ProgressDisplayMode) => void;
}

const Header = styled.View({
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: spacing.md,
});

const Title = styled.Text({
  color: colors.ink,
  fontFamily: 'serif',
  fontSize: 24,
  fontWeight: '700',
});

const Shelf = styled.View({
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderRadius: radii.lg,
  borderWidth: 1,
  minHeight: 254,
  overflow: 'hidden',
  paddingTop: spacing.lg,
});

const BooksRow = styled.View({
  alignItems: 'flex-end',
  flexDirection: 'row',
  gap: 6,
  minHeight: 212,
  paddingHorizontal: spacing.md,
});

const ShelfRail = styled.View({
  backgroundColor: colors.shelfWood,
  borderTopColor: 'rgba(255, 255, 255, 0.28)',
  borderTopWidth: 1,
  height: 18,
  shadowColor: colors.shelfWoodDark,
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.2,
  shadowRadius: 6,
  elevation: 4,
});

const Hint = styled.Text({
  color: colors.inkMuted,
  fontSize: 12,
  marginTop: spacing.sm,
});

export const VirtualShelfPreview = ({
  books,
  mode,
  onChangeMode,
}: VirtualShelfPreviewProps) => {
  const [activeBookId, setActiveBookId] = useState(books[0]?.id ?? '');

  const activeBook = useMemo(
    () => books.find((book) => book.id === activeBookId),
    [activeBookId, books],
  );

  const changeMode = (nextMode: ProgressDisplayMode) => {
    onChangeMode(nextMode);
  };

  return (
    <>
      <Header>
        <Title>Моя полка</Title>
        <SegmentedControl
          onChange={changeMode}
          options={[{ label: '%', value: 'percentage' }, { label: 'Страницы', value: 'pages' }]}
          value={mode}
        />
      </Header>

      <Shelf>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BooksRow>
            {books.map((book) => {
              const progress = {
                currentPage: book.currentPage,
                totalPages: book.totalPages,
              };

              return (
                <BookSpine
                  key={book.id}
                  active={activeBookId === book.id}
                  color={book.spineColor}
                  height={book.spineHeight}
                  onPress={() => {
                    setActiveBookId(book.id);
                    void Haptics.selectionAsync();
                  }}
                  progress={getReadingProgressRatio(progress)}
                  progressLabel={formatReadingProgress(progress, mode)}
                  title={book.title}
                  width={book.spineWidth}
                />
              );
            })}
          </BooksRow>
        </ScrollView>
        <ShelfRail />
      </Shelf>

      <Hint>
        {activeBook
          ? `${activeBook.title} · ${activeBook.author}`
          : 'Нажми на корешок, чтобы выбрать книгу'}
      </Hint>
    </>
  );
};
