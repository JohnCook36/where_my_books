import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { FinishReadingSessionResponse, ReadingHistoryResponse, ReadingSessionResponse } from '@where-my-books/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { FinishReadingSessionDto } from './reading.dto.js';
import { ReadingService } from './reading.service.js';

@UseGuards(JwtAuthGuard)
@Controller('books/:bookId/reading')
export class ReadingController {
  constructor(private readonly reading: ReadingService) {}

  @Get()
  history(@CurrentUser() user: AccessTokenPayload, @Param('bookId', new ParseUUIDPipe()) bookId: string): Promise<ReadingHistoryResponse> {
    return this.reading.history(user.sub, bookId);
  }

  @Post('sessions/start')
  start(@CurrentUser() user: AccessTokenPayload, @Param('bookId', new ParseUUIDPipe()) bookId: string): Promise<ReadingSessionResponse> {
    return this.reading.start(user.sub, bookId);
  }

  @Post('sessions/:sessionId/finish')
  finish(@CurrentUser() user: AccessTokenPayload, @Param('bookId', new ParseUUIDPipe()) bookId: string, @Param('sessionId', new ParseUUIDPipe()) sessionId: string, @Body() body: FinishReadingSessionDto): Promise<FinishReadingSessionResponse> {
    return this.reading.finish(user.sub, bookId, sessionId, body.endPage);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(204)
  cancel(@CurrentUser() user: AccessTokenPayload, @Param('bookId', new ParseUUIDPipe()) bookId: string, @Param('sessionId', new ParseUUIDPipe()) sessionId: string): Promise<void> {
    return this.reading.cancel(user.sub, bookId, sessionId);
  }
}
