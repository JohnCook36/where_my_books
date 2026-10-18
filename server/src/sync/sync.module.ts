import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BooksModule } from '../books/books.module.js';
import { PrismaService } from '../prisma.service.js';
import { BooksService } from '../books/books.service.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

@Module({ imports: [AuthModule, BooksModule], controllers: [SyncController], providers: [SyncService, PrismaService, BooksService] })
export class SyncModule {}
