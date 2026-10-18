import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma.service.js';
import { BooksController } from './books.controller.js';
import { BooksService } from './books.service.js';
import { JournalController } from '../journal/journal.controller.js';
import { JournalService } from '../journal/journal.service.js';

@Module({ imports: [AuthModule], controllers: [BooksController, JournalController], providers: [BooksService, JournalService, PrismaService], exports: [BooksService] })
export class BooksModule {}
