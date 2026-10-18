import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { CoverUploadGuard } from './cover-upload.guard.js';
function request(guard: CoverUploadGuard, sub: string) {
  const response = Object.assign(new EventEmitter(), { setHeader: vi.fn() });
  const context = { switchToHttp: () => ({ getRequest: () => ({ user: { sub } }), getResponse: () => response }) };
  return { response, activate: () => guard.canActivate(context as never) };
}
describe('cover upload limits before buffering', () => {
  it('bounds parallel work per owner and releases once on finish/close', () => {
    const guard = new CoverUploadGuard(); const a = request(guard, 'a'); const b = request(guard, 'a');
    a.activate(); b.activate(); expect(() => request(guard, 'a').activate()).toThrow();
    a.response.emit('finish'); a.response.emit('close');
    request(guard, 'a').activate(); expect(() => request(guard, 'a').activate()).toThrow();
  });
  it('bounds global parallel work across accounts', () => {
    const guard = new CoverUploadGuard(); for (const user of ['a', 'b', 'c', 'd']) request(guard, user).activate();
    expect(() => request(guard, 'e').activate()).toThrow();
  });
  it('bounds repeated uploads and permits retry after the time window', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      const guard = new CoverUploadGuard(); for (let i = 0; i < 30; i++) { const req = request(guard, 'a'); req.activate(); req.response.emit('finish'); }
      const blocked = request(guard, 'a'); expect(blocked.activate).toThrow(); expect(blocked.response.setHeader).toHaveBeenCalledWith('Retry-After', '60');
      clock.mockReturnValue(61_001); expect(request(guard, 'a').activate()).toBe(true);
    } finally { clock.mockRestore(); }
  });
});
