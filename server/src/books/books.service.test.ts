import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BooksService } from './books.service.js';

const book = { userId: 'owner', edition: { pageCount: 100 } };

describe('BooksService ownership and progress rules', () => {
  it('rejects progress beyond the edition page count', async () => {
    const prisma = { bookCopy: { findUnique: vi.fn().mockResolvedValue(book) } };
    const service = new BooksService(prisma as never);
    await expect(service.updateProgress('owner', 'copy', { currentPage: 101 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects access to another user copy', async () => {
    const prisma = { bookCopy: { findUnique: vi.fn().mockResolvedValue({ ...book, userId: 'other' }) } };
    const service = new BooksService(prisma as never);
    await expect(service.get('owner', 'copy')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
