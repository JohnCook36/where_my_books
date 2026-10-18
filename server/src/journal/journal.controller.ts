import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import type { CreateJournalEntryRequest, JournalEntryResponse, ListJournalEntriesResponse, UpdateJournalEntryRequest } from '@where-my-books/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { CreateJournalEntryDto, UpdateJournalEntryDto } from './dto/journal.dto.js';
import { JournalService } from './journal.service.js';

@UseGuards(JwtAuthGuard)
@Controller('books/:bookId/journal')
export class JournalController {
  constructor(private readonly journal: JournalService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload, @Param('bookId', new ParseUUIDPipe()) copyId: string): Promise<ListJournalEntriesResponse> {
    return this.journal.list(user.sub, copyId);
  }

  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Param('bookId', new ParseUUIDPipe()) copyId: string, @Body() dto: CreateJournalEntryDto): Promise<JournalEntryResponse> {
    return this.journal.create(user.sub, copyId, dto as CreateJournalEntryRequest);
  }

  @Patch(':entryId')
  update(@CurrentUser() user: AccessTokenPayload, @Param('bookId', new ParseUUIDPipe()) copyId: string, @Param('entryId', new ParseUUIDPipe()) entryId: string, @Body() dto: UpdateJournalEntryDto): Promise<JournalEntryResponse> {
    return this.journal.update(user.sub, copyId, entryId, dto as UpdateJournalEntryRequest);
  }

  @Delete(':entryId')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('bookId', new ParseUUIDPipe()) copyId: string, @Param('entryId', new ParseUUIDPipe()) entryId: string): Promise<void> {
    return this.journal.remove(user.sub, copyId, entryId);
  }
}
