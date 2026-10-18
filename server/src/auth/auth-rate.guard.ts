import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { createHash } from 'node:crypto';

/**
 * A bounded per-process fail-fast rate limit for public auth endpoints.
 * Deliberately keyed by socket-derived Express req.ip, never by spoofable
 * X-Forwarded-For unless the deployment explicitly configures trusted proxies.
 * Distributed deployments still require a shared reverse-proxy/Redis limit.
 */
@Injectable()
export class AuthRateGuard implements CanActivate {
  private readonly buckets = new Map<string, { count: number; expiresAt: number }>();
  private readonly windowMs = 5 * 60_000;
  private readonly limit = 30;
  private readonly maxBuckets = 20_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      socket?: { remoteAddress?: string };
      route?: { path?: string };
      path?: string;
    }>();
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const path = request.route?.path ?? request.path ?? 'auth';
    const key = createHash('sha256').update(ip + '|' + path).digest('hex');
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      if (this.buckets.size >= this.maxBuckets) {
        // Bounded memory under high-cardinality abuse.
        for (const [k, candidate] of this.buckets) {
          if (candidate.expiresAt <= now) this.buckets.delete(k);
        }
        if (this.buckets.size >= this.maxBuckets) {
          const oldest = this.buckets.keys().next().value;
          if (oldest) this.buckets.delete(oldest);
        }
      }
      bucket = { count: 0, expiresAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    if (bucket.count >= this.limit) throw new HttpException('Too many authentication attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    bucket.count += 1;
    return true;
  }
}
