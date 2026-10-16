import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma.service.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

@Module({ imports: [AuthModule], controllers: [SettingsController], providers: [SettingsService, PrismaService] })
export class SettingsModule {}
