export type ProgressDisplayMode = 'percentage' | 'pages';

export type ReadingStatus = 'want_to_read' | 'reading' | 'finished' | 'dnf';

export interface ReadingProgress {
  currentPage: number;
  totalPages: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const normalizeTotalPages = (totalPages: number): number =>
  Number.isFinite(totalPages) ? Math.max(0, Math.round(totalPages)) : 0;

const normalizeCurrentPage = (currentPage: number, totalPages: number): number => {
  const safeCurrentPage = Number.isFinite(currentPage) ? Math.round(currentPage) : 0;
  return clamp(safeCurrentPage, 0, totalPages);
};

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

  const totalPages = normalizeTotalPages(progress.totalPages);
  const currentPage = normalizeCurrentPage(progress.currentPage, totalPages);
  return `${currentPage} / ${totalPages}`;
};
