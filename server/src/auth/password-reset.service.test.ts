import { describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';

const jwt = { signAsync: vi.fn() };
const config = { getOrThrow: vi.fn() };
const delivery = { isConfigured: vi.fn(() => true), send: vi.fn().mockResolvedValue(undefined) };

describe('Password reset security', () => {
  it('fails closed if delivery is unavailable', async () => {
    const prisma = { user: { findUnique: vi.fn() } };
    const service = new AuthService(prisma as never, jwt as never, config as never, { isConfigured: () => false } as never);
    await expect(service.requestPasswordReset('example@test.invalid')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns silently for non-existing emails', async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    const service = new AuthService(prisma as never, jwt as never, config as never, delivery as never);
    await expect(service.requestPasswordReset('unknown@test.invalid')).resolves.toBeUndefined();
    expect(delivery.send).not.toHaveBeenCalled();
  });

  it('stores only a hashed token, and sends the raw secret via mail', async () => {
    const user = { id: 'user', email: 'known@test.invalid' };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(user) },
      passwordReset: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'reset' }), deleteMany: vi.fn() },
    };
    const send = vi.fn().mockResolvedValue(undefined);
    const service = new AuthService(prisma as never, jwt as never, config as never, { isConfigured: () => true, send } as never);
    await service.requestPasswordReset(user.email);
    const [address, raw] = send.mock.calls[0]!;
    expect(address).toBe(user.email);
    expect(typeof raw).toBe('string');
    const created = prisma.passwordReset.create.mock.calls[0]![0].data;
    expect(created.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(created.tokenHash).not.toBe(raw);
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('consumes exactly one reset and revokes all sessions in the same transaction', async () => {
    const record = { id: 'r', userId: 'u', consumedAt: null, expiresAt: new Date(Date.now() + 60_000) };
    const tx = {
      passwordReset: { findUnique: vi.fn().mockResolvedValue(record), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      user: { update: vi.fn().mockResolvedValue({}) },
      session: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = { $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)) };
    const service = new AuthService(prisma as never, jwt as never, config as never, delivery as never);
    await service.resetPassword('valid-test-token', 'new-password-123');
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(tx.session.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u', revokedAt: null } }));
    tx.passwordReset.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.resetPassword('valid-test-token', 'another-password-123')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
