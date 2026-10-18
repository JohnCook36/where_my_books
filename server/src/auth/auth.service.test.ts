import { describe, expect, it, vi } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';

const user = { id: 'user', email: 'reader@example.com', passwordHash: '', createdAt: new Date() };
const jwt = { signAsync: vi.fn().mockResolvedValue('access-token') };
const config = { getOrThrow: vi.fn().mockReturnValue('test-secret') };

describe('AuthService', () => {
  it('rejects duplicate registration', async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(user) } };
    await expect(new AuthService(prisma as never, jwt as never, config as never).register({ email: user.email, password: 'password123' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid login', async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(new AuthService(prisma as never, jwt as never, config as never).login({ email: user.email, password: 'password123' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates refresh tokens and revokes the old session', async () => {
    const session = { id: 'session', revokedAt: null, expiresAt: new Date(Date.now() + 60_000), user };
    const prisma = { session: { findUnique: vi.fn().mockResolvedValue(session), update: vi.fn(), create: vi.fn() }, $transaction: vi.fn().mockResolvedValue([]) };
    const service = new AuthService(prisma as never, jwt as never, config as never);
    const result = await service.refresh({ refreshToken: 'old-refresh-token-1234567890' });
    expect(result.accessToken).toBe('access-token');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('revokes a refresh session on logout', async () => {
    const prisma = { session: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };
    await new AuthService(prisma as never, jwt as never, config as never).logout('refresh-token-1234567890');
    expect(prisma.session.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { revokedAt: expect.any(Date) } }));
  });
});
