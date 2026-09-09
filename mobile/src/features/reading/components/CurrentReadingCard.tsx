import styled from '@emotion/native';
import {
  formatReadingProgress,
  getReadingProgressRatio,
  type ProgressDisplayMode,
} from '@where-my-books/shared';
import {
  PillButton,
  ReadingProgressBar,
  SurfaceCard,
  colors,
  spacing,
} from '@where-my-books/ui/native';
import * as Haptics from 'expo-haptics';

import type { LibraryBookPreview } from '../../library/mockBooks';

interface CurrentReadingCardProps {
  book: LibraryBookPreview;
  progressMode: ProgressDisplayMode;
  onAddPages: (bookId: string, pages: number) => void;
}

const Eyebrow = styled.Text({
  color: colors.burgundy,
  fontSize: 11,
  fontWeight: '800',
  letterSpacing: 1.1,
  marginBottom: spacing.xs,
  textTransform: 'uppercase',
});

const BookTitle = styled.Text({
  color: colors.ink,
  fontFamily: 'serif',
  fontSize: 26,
  fontWeight: '700',
  lineHeight: 32,
});

const Author = styled.Text({
  color: colors.inkSecondary,
  fontSize: 14,
  marginBottom: spacing.lg,
  marginTop: 4,
});

const ProgressWrap = styled.View({
  marginBottom: spacing.lg,
});

export const CurrentReadingCard = ({
  book,
  progressMode,
  onAddPages,
}: CurrentReadingCardProps) => {
  const progress = {
    currentPage: book.currentPage,
    totalPages: book.totalPages,
  };

  const addPages = () => {
    onAddPages(book.id, 10);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SurfaceCard>
      <Eyebrow>Сейчас читаю</Eyebrow>
      <BookTitle>{book.title}</BookTitle>
      <Author>{book.author}</Author>

      <ProgressWrap>
        <ReadingProgressBar
          label={formatReadingProgress(progress, progressMode)}
          value={getReadingProgressRatio(progress)}
        />
      </ProgressWrap>

      <PillButton label="+ 10 страниц" onPress={addPages} />
    </SurfaceCard>
  );
};
