import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma.service.js';
import { CoversController } from './covers.controller.js';
import { CoverUploadGuard } from './cover-upload.guard.js';
import { CoversService } from './covers.service.js';
@Module({ imports: [AuthModule], controllers: [CoversController], providers: [CoversService, PrismaService, CoverUploadGuard] })
export class CoversModule {}
