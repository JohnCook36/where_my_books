import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from './settings.service.js';

describe('SettingsService', () => {
  it('creates and returns the default setting', async () => {
    const settings = { id: 'setting', userId: 'user-a', progressDisplayMode: 'pages', createdAt: new Date(), updatedAt: new Date() };
    const prisma = { userSettings: { upsert: vi.fn().mockResolvedValue(settings) } };
    const result = await new SettingsService(prisma as never).get('user-a');
    expect(result.settings.userId).toBe('user-a');
    expect(result.settings.progressDisplayMode).toBe('pages');
  });

  it('updates settings without affecting another user', async () => {
    const first = { id: 'a', userId: 'user-a', progressDisplayMode: 'percentage', createdAt: new Date(), updatedAt: new Date() };
    const prisma = { userSettings: { upsert: vi.fn().mockResolvedValue(first) } };
    const result = await new SettingsService(prisma as never).update('user-a', { progressDisplayMode: 'percentage' });
    expect(result.settings.userId).toBe('user-a');
    expect(prisma.userSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a' } }));
  });
});
