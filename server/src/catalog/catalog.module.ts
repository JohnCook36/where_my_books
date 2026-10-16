import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
@Module({ imports: [AuthModule], controllers: [CatalogController], providers: [CatalogService, PrismaService] })
export class CatalogModule {}
