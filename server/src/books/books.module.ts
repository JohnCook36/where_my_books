import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma.service.js';
import { BooksController } from './books.controller.js';
import { BooksService } from './books.service.js';
import { JournalController } from '../journal/journal.controller.js';
import { JournalService } from '../journal/journal.service.js';
import { ReadingController } from '../reading/reading.controller.js';
import { ReadingService } from '../reading/reading.service.js';

@Module({ imports: [AuthModule], controllers: [BooksController, JournalController, ReadingController], providers: [BooksService, JournalService, ReadingService, PrismaService], exports: [BooksService] })
export class BooksModule {}
