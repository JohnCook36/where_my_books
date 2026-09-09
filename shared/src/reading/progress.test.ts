import { describe, expect, it } from 'vitest';

import {
  formatReadingProgress,
  getReadingProgressPercent,
  getReadingProgressRatio,
} from './progress';

describe('getReadingProgressRatio', () => {
  it('calculates reading progress ratio', () => {
    expect(getReadingProgressRatio({ currentPage: 220, totalPages: 604 })).toBeCloseTo(
      220 / 604,
      10,
    );
  });

  it('clamps progress below zero', () => {
    expect(getReadingProgressRatio({ currentPage: -20, totalPages: 604 })).toBe(0);
  });

  it('clamps progress above the end of the book', () => {
    expect(getReadingProgressRatio({ currentPage: 700, totalPages: 604 })).toBe(1);
  });

  it.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY])(
    'returns zero for invalid total pages: %s',
    (totalPages) => {
      expect(getReadingProgressRatio({ currentPage: 100, totalPages })).toBe(0);
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'treats invalid current page as zero: %s',
    (currentPage) => {
      expect(getReadingProgressRatio({ currentPage, totalPages: 604 })).toBe(0);
    },
  );
});

describe('getReadingProgressPercent', () => {
  it('rounds progress to the nearest whole percent', () => {
    expect(getReadingProgressPercent({ currentPage: 220, totalPages: 604 })).toBe(36);
  });

  it('never returns more than one hundred percent', () => {
    expect(getReadingProgressPercent({ currentPage: 700, totalPages: 604 })).toBe(100);
  });
});

describe('formatReadingProgress', () => {
  it('formats progress as percentage', () => {
    expect(formatReadingProgress({ currentPage: 220, totalPages: 604 }, 'percentage')).toBe(
      '36%',
    );
  });

  it('formats progress as pages', () => {
    expect(formatReadingProgress({ currentPage: 220, totalPages: 604 }, 'pages')).toBe(
      '220 / 604',
    );
  });

  it('rounds page values and clamps the current page to the total', () => {
    expect(formatReadingProgress({ currentPage: 610.8, totalPages: 604.4 }, 'pages')).toBe(
      '604 / 604',
    );
  });

  it('formats invalid page values safely', () => {
    expect(
      formatReadingProgress(
        { currentPage: Number.NaN, totalPages: Number.POSITIVE_INFINITY },
        'pages',
      ),
    ).toBe('0 / 0');
  });
});
