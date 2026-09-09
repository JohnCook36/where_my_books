export type ProgressDisplayMode = 'percentage' | 'pages';

export type ReadingStatus = 'want_to_read' | 'reading' | 'finished' | 'dnf';

export interface ReadingProgress {
  currentPage: number;
  totalPages: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const getReadingProgressRatio = ({
  currentPage,
  totalPages,
}: ReadingProgress): number => {
  if (!Number.isFinite(totalPages) || totalPages <= 0) {
    return 0;
  }

  const safeCurrentPage = Number.isFinite(currentPage) ? currentPage : 0;
  return clamp(safeCurrentPage / totalPages, 0, 1);
};

export const getReadingProgressPercent = (progress: ReadingProgress): number =>
  Math.round(getReadingProgressRatio(progress) * 100);

export const formatReadingProgress = (
  progress: ReadingProgress,
  mode: ProgressDisplayMode,
): string => {
  if (mode === 'percentage') {
    return `${getReadingProgressPercent(progress)}%`;
  }

  const totalPages = Math.max(0, Math.round(progress.totalPages));
  const currentPage = clamp(Math.round(progress.currentPage), 0, totalPages);
  return `${currentPage} / ${totalPages}`;
};
