import { describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import { AuthRateGuard } from './auth-rate.guard.js';

const ctx = (ip: string, path: string) => ({
  switchToHttp: () => ({ getRequest: () => ({ ip, route: { path } }) }),
}) as never;

describe('AuthRateGuard', () => {
  it('limits an IP and route combination but not other clients or routes', () => {
    const guard = new AuthRateGuard();
    for (let attempt = 0; attempt < 30; attempt++) expect(guard.canActivate(ctx('192.0.2.2', '/login'))).toBe(true);
    expect(() => guard.canActivate(ctx('192.0.2.2', '/login'))).toThrow(TooManyRequestsException);
    expect(guard.canActivate(ctx('192.0.2.3', '/login'))).toBe(true);
    expect(guard.canActivate(ctx('192.0.2.2', '/register'))).toBe(true);
  });
});
