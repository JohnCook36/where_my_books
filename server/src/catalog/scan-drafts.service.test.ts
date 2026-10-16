import 'reflect-metadata';
import { ScanReviewPayloadDto } from './scan-drafts.dto.js';
import { describe, expect, it, vi } from 'vitest';
import { readyPayload, ScanDraftsService } from './scan-drafts.service.js';

describe('scan batch confirmation', () => {
  it.each([null, {}, { title: 'Title' }, { title: ' ', author: 'Author' }, { title: 'Title', author: 'Author', authors: [' '] }])('does not call an incomplete payload reviewed', (payload) => expect(readyPayload(payload)).toBe(false));
  it('accepts a runtime DTO whose inherited ISBN field is declared but undefined', async () => {
    const payload = Object.assign(new ScanReviewPayloadDto(), { isbn: undefined, title: 'Incomplete review' });
    const stored = { id: 'draft', userId: 'owner', isbn: '9780306406157', revision: 0, reviewed: false, payload: null, createdAt: new Date(), updatedAt: new Date() };
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      scanDraft: { findFirst: vi.fn().mockResolvedValue(stored), update: vi.fn().mockResolvedValue({ ...stored, revision: 1, payload: { title: 'Incomplete review' } }) },
    };
    const prisma = { $transaction: vi.fn((fn) => fn(tx)) };
    const service = new ScanDraftsService(prisma as never, {} as never);
    const result = await service.update('owner', 'draft', { baseRevision: 0, reviewed: false, payload });
    expect(result.revision).toBe(1); expect(result.payload).toEqual({ title: 'Incomplete review' });
  });
  it('accepts an unknown page count and deliberate manual metadata', () => expect(readyPayload({ title: 'Book', author: 'Author', totalPages: 0 })).toBe(true));
  it('does not stop the batch when one database transaction fails', async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      bookCopy: { findUnique: vi.fn().mockResolvedValue(null) },
      scanDraft: { findFirst: vi.fn().mockResolvedValue({ id: 'ok', isbn: '9780306406157', revision: 2, reviewed: true, payload: { title: 'Book', author: 'Author', totalPages: 0 } }) },
    };
    const prisma = { $transaction: vi.fn().mockRejectedValueOnce(new Error('DB disconnected')).mockImplementationOnce((fn) => fn(tx)) };
    const books = { createInTransaction: vi.fn().mockResolvedValue({ id: 'saved-copy' }) };
    const service = new ScanDraftsService(prisma as never, books as never);
    const result = await service.confirm('owner', [{ id: 'failed', revision: 1 }, { id: 'ok', revision: 2 }]);
    expect(result.results.map((r) => r.status)).toEqual(['failed', 'saved']);
    expect(books.createInTransaction).toHaveBeenCalledTimes(1);
  });
  it('never reveals a saved copy through another account replay key', async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(1), bookCopy: { findUnique: vi.fn().mockResolvedValue(null) }, scanDraft: { findFirst: vi.fn().mockResolvedValue(null) } };
    const prisma = { $transaction: vi.fn((fn) => fn(tx)) }; const books = { createInTransaction: vi.fn() };
    const service = new ScanDraftsService(prisma as never, books as never);
    expect((await service.confirm('other', [{ id: 'someone-elses-draft', revision: 1 }])).results[0]?.status).toBe('not_found');
    expect(tx.bookCopy.findUnique).toHaveBeenCalledWith({ where: { userId_clientRequestId: { userId: 'other', clientRequestId: 'someone-elses-draft' } } });
    expect(books.createInTransaction).not.toHaveBeenCalled();
  });
});
