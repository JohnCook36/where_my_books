import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import type { AccessTokenPayload } from './auth.types.js';

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: AccessTokenPayload }>();
    const token = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice(7)
      : null;
    if (!token) throw new UnauthorizedException('Bearer token is required');
    let claims: AccessTokenPayload;
    try {
      claims = this.jwt.verify<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    // Old pre-session-bound access tokens fail closed; the mobile client can
    // refresh them with an existing refresh token and receive a bound JWT.
    if (!isUuid(claims.sub) || !isUuid(claims.sessionId)) throw new UnauthorizedException('Invalid access session');
    const active = await this.prisma.session.findFirst({
      where: { id: claims.sessionId, userId: claims.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!active) throw new UnauthorizedException('Session has expired or was revoked');
    request.user = claims;
    return true;
  }
}
