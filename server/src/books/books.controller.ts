import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import type { BookDetailsResponse, CreateBookRequest, ListBooksResponse, SearchBooksResponse, UpdateBookRequest, UpdateReadingProgressRequest, UpdateReadingStatusRequest } from '@where-my-books/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { BooksService } from './books.service.js';
import { CreateBookDto, UpdateBookDto, UpdateProgressDto, UpdateStatusDto } from './dto/books.dto.js';
import { SearchBooksDto } from './dto/search-books.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}
  @Get() list(@CurrentUser() user: AccessTokenPayload): Promise<ListBooksResponse> { return this.books.list(user.sub); }
  @Get('search') search(@CurrentUser() user: AccessTokenPayload, @Query() query: SearchBooksDto): Promise<SearchBooksResponse> { return this.books.search(user.sub, query); }
  @Post() create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateBookDto): Promise<BookDetailsResponse> { return this.books.create(user.sub, dto as CreateBookRequest); }
  @Get(':id') get(@CurrentUser() user: AccessTokenPayload, @Param('id', new ParseUUIDPipe()) id: string): Promise<BookDetailsResponse> { return this.books.get(user.sub, id); }
  @Patch(':id') update(@CurrentUser() user: AccessTokenPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateBookDto): Promise<BookDetailsResponse> { return this.books.update(user.sub, id, dto as UpdateBookRequest); }
  @Delete(':id') remove(@CurrentUser() user: AccessTokenPayload, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> { return this.books.remove(user.sub, id); }
  @Patch(':id/status') status(@CurrentUser() user: AccessTokenPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateStatusDto): Promise<BookDetailsResponse> { return this.books.updateStatus(user.sub, id, dto as UpdateReadingStatusRequest); }
  @Patch(':id/progress') progress(@CurrentUser() user: AccessTokenPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateProgressDto): Promise<BookDetailsResponse> { return this.books.updateProgress(user.sub, id, dto as UpdateReadingProgressRequest); }
}
