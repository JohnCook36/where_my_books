import { describe, expect, it } from 'vitest';

import { formatReadingProgress, getReadingProgressPercent, getReadingProgressRatio } from './progress';

describe('reading progress', () => {
  it('calculates and clamps a ratio', () => {
    expect(getReadingProgressRatio({ currentPage: 220, totalPages: 604 })).toBeCloseTo(220 / 604, 10);
    expect(getReadingProgressRatio({ currentPage: -20, totalPages: 604 })).toBe(0);
    expect(getReadingProgressRatio({ currentPage: 700, totalPages: 604 })).toBe(1);
  });
  it('handles invalid totals and current pages safely', () => {
    expect(getReadingProgressRatio({ currentPage: 100, totalPages: Number.NaN })).toBe(0);
    expect(getReadingProgressRatio({ currentPage: Number.NaN, totalPages: 604 })).toBe(0);
  });
  it('formats pages and percentages', () => {
    expect(getReadingProgressPercent({ currentPage: 220, totalPages: 604 })).toBe(36);
    expect(formatReadingProgress({ currentPage: 220, totalPages: 604 }, 'percentage')).toBe('36%');
    expect(formatReadingProgress({ currentPage: 220, totalPages: 604 }, 'pages')).toBe('220 / 604');
    expect(formatReadingProgress({ currentPage: 610.8, totalPages: 604.4 }, 'pages')).toBe('604 / 604');
  });
});

describe('getReadingProgressRatio edge cases', () => {
  it('treats invalid current page as zero', () => {
    expect(getReadingProgressRatio({ currentPage: Number.POSITIVE_INFINITY, totalPages: 604 })).toBe(0);
    expect(getReadingProgressRatio({ currentPage: Number.NEGATIVE_INFINITY, totalPages: 604 })).toBe(0);
  });
  it('returns zero for non-positive totals', () => {
    expect(getReadingProgressRatio({ currentPage: 100, totalPages: 0 })).toBe(0);
    expect(getReadingProgressRatio({ currentPage: 100, totalPages: -10 })).toBe(0);
  });
});

describe('getReadingProgressPercent edge cases', () => {
  it('never returns more than one hundred percent', () => {
    expect(getReadingProgressPercent({ currentPage: 700, totalPages: 604 })).toBe(100);
  });
});

describe('formatReadingProgress edge cases', () => {
  it('formats invalid page values safely', () => {
    expect(formatReadingProgress({ currentPage: Number.NaN, totalPages: Number.POSITIVE_INFINITY }, 'pages')).toBe('0 / 0');
  });
});
