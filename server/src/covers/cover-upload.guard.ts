import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
/** Before multipart buffering/decoding. Per-instance limits; a proxy-wide quota is a production gate. */
@Injectable()
export class CoverUploadGuard implements CanActivate {
  private active = 0;
  private readonly users = new Map<string, { count: number; active: number; resetAt: number }>();
  canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const { sub } = http.getRequest<{ user: { sub: string } }>().user;
    const response = http.getResponse<ServerResponse>();
    const now = Date.now();
    for (const [key, entry] of this.users) if (entry.resetAt <= now && entry.active === 0) this.users.delete(key);
    const entry = this.users.get(sub) ?? { count: 0, active: 0, resetAt: now + 60_000 };
    if (entry.resetAt <= now) { entry.count = 0; entry.resetAt = now + 60_000; }
    if (entry.count >= 30 || entry.active >= 2 || this.active >= 4 || (!this.users.has(sub) && this.users.size >= 1000)) {
      response.setHeader('Retry-After', '60');
      throw new HttpException('Загрузка обложек занята. Повторите через минуту.', 429);
    }
    entry.count++; entry.active++; this.active++; this.users.set(sub, entry);
    let released = false;
    const release = () => { if (!released) { released = true; entry.active--; this.active--; } };
    response.once('finish', release); response.once('close', release);
    return true;
  }
}
