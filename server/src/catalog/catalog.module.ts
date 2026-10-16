import { BooksModule } from '../books/books.module.js';
import { ScanDraftsService } from './scan-drafts.service.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
@Module({ imports: [AuthModule, BooksModule], controllers: [CatalogController], providers: [CatalogService, ScanDraftsService, PrismaService] })
export class CatalogModule {}
