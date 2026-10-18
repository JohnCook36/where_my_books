import { describe, expect, it, vi } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';

const user = { id: 'user', email: 'reader@example.com', passwordHash: '', createdAt: new Date() };
const jwt = { signAsync: vi.fn().mockResolvedValue('access-token') };
const config = { getOrThrow: vi.fn().mockReturnValue('test-secret') };

describe('AuthService', () => {
  it('rejects duplicate registration', async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(user) } };
    await expect(new AuthService(prisma as never, jwt as never, config as never, { isConfigured: () => false } as never).register({ email: user.email, password: 'password123' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid login', async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(new AuthService(prisma as never, jwt as never, config as never, { isConfigured: () => false } as never).login({ email: user.email, password: 'password123' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates the refresh token only after a conditional single-use claim', async () => {
    const session = { id: 'session', revokedAt: null, expiresAt: new Date(Date.now() + 60_000), user };
    const tx = {
      session: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn().mockResolvedValue({ id: 'next' }) },
    };
    const prisma = {
      session: { findUnique: vi.fn().mockResolvedValue(session) },
      $transaction: vi.fn().mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const service = new AuthService(prisma as never, jwt as never, config as never, { isConfigured: () => false } as never);
    const result = await service.refresh({ refreshToken: 'old-refresh-token-1234567890' });
    expect(result.accessToken).toBe('access-token');
    expect(tx.session.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'session', revokedAt: null, expiresAt: { gt: expect.any(Date) } },
    }));
    expect(tx.session.create).toHaveBeenCalledTimes(1);
    const created = tx.session.create.mock.calls[0];
    if (!created) throw new Error('Expected a replacement session creation');
    const createdId = created[0].data.id;
    expect(createdId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({ sessionId: createdId }), expect.any(Object));
  });

  it('rejects replayed refresh tokens without issuing a replacement session', async () => {
    const session = { id: 'session', revokedAt: null, expiresAt: new Date(Date.now() + 60_000), user };
    const tx = {
      session: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn() },
    };
    const prisma = {
      session: { findUnique: vi.fn().mockResolvedValue(session) },
      $transaction: vi.fn().mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const service = new AuthService(prisma as never, jwt as never, config as never, { isConfigured: () => false } as never);
    await expect(service.refresh({ refreshToken: 'old-refresh-token-1234567890' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.session.create).not.toHaveBeenCalled();
  });

  it('revokes all the user sessions without touching another owner', async () => {
    const prisma = { session: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) } };
    await new AuthService(prisma as never, jwt as never, config as never, { isConfigured: () => false } as never).revokeAllSessions('owner');
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'owner', revokedAt: null }, data: { revokedAt: expect.any(Date) },
    });
  });

  it('revokes a refresh session on logout', async () => {
    const prisma = { session: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };
    await new AuthService(prisma as never, jwt as never, config as never, { isConfigured: () => false } as never).logout('refresh-token-1234567890');
    expect(prisma.session.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { revokedAt: expect.any(Date) } }));
  });
});
