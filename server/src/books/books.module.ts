import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma.service.js';
import { BooksController } from './books.controller.js';
import { BooksService } from './books.service.js';

@Module({ imports: [AuthModule], controllers: [BooksController], providers: [BooksService, PrismaService] })
export class BooksModule {}
