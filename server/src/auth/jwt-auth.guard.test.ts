import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const context = () => {
  const request = { headers: { authorization: 'Bearer valid' }, user: undefined as unknown };
  const execution = { switchToHttp: () => ({ getRequest: () => request }) } as never;
  return { request, execution };
};

describe('JwtAuthGuard', () => {
  it('accepts only JWTs bound to an active session belonging to the subject', async () => {
    const id = randomUUID(), sessionId = randomUUID();
    const jwt = { verify: vi.fn().mockReturnValue({ sub: id, sessionId, email: 'owner@test.invalid' }) };
    const prisma = { session: { findFirst: vi.fn().mockResolvedValue({ id: sessionId }) } };
    const { request, execution } = context();
    expect(await new JwtAuthGuard(jwt as never, prisma as never).canActivate(execution)).toBe(true);
    expect(prisma.session.findFirst).toHaveBeenCalledWith({ where: { id: sessionId, userId: id, revokedAt: null, expiresAt: { gt: expect.any(Date) } }, select: { id: true } });
    expect(request.user).toEqual({ sub: id, sessionId, email: 'owner@test.invalid' });
  });

  it('rejects a revoked session even while the JWT signature remains valid', async () => {
    const jwt = { verify: vi.fn().mockReturnValue({ sub: randomUUID(), sessionId: randomUUID() }) };
    const prisma = { session: { findFirst: vi.fn().mockResolvedValue(null) } };
    const { execution } = context();
    await expect(new JwtAuthGuard(jwt as never, prisma as never).canActivate(execution)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects legacy unbound session identifiers and invalid JWT signatures', async () => {
    const prisma = { session: { findFirst: vi.fn() } };
    const { execution } = context();
    const legacy = { verify: vi.fn().mockReturnValue({ sub: randomUUID(), sessionId: '0123456789abcdef0123456789abcdef' }) };
    await expect(new JwtAuthGuard(legacy as never, prisma as never).canActivate(execution)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.session.findFirst).not.toHaveBeenCalled();
    const invalid = { verify: vi.fn().mockImplementation(() => { throw new Error('Expired'); }) };
    await expect(new JwtAuthGuard(invalid as never, prisma as never).canActivate(execution)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
