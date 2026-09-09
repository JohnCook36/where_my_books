import { Injectable } from '@nestjs/common';
import type { UserSettingsResponse, UpdateUserSettingsRequest } from '@where-my-books/shared';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}
  async get(userId: string): Promise<UserSettingsResponse> {
    const settings = await this.prisma.userSettings.upsert({ where: { userId }, create: { userId }, update: {} });
    return { settings: { id: settings.id, userId: settings.userId, progressDisplayMode: settings.progressDisplayMode, createdAt: settings.createdAt.toISOString(), updatedAt: settings.updatedAt.toISOString() } };
  }
  async update(userId: string, dto: UpdateUserSettingsRequest): Promise<UserSettingsResponse> {
    await this.prisma.userSettings.upsert({ where: { userId }, create: { userId, progressDisplayMode: dto.progressDisplayMode }, update: { progressDisplayMode: dto.progressDisplayMode } });
    return this.get(userId);
  }
}
