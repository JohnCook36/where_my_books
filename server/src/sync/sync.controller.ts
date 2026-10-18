import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { SyncBootstrapResponse, SyncChangesResponse } from '@where-my-books/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { SyncService } from './sync.service.js';

@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get('bootstrap')
  bootstrap(@CurrentUser() user: AccessTokenPayload): Promise<SyncBootstrapResponse> {
    return this.sync.bootstrap(user.sub);
  }

  @Get('changes')
  changes(@CurrentUser() user: AccessTokenPayload, @Query('after') after: string): Promise<SyncChangesResponse> {
    return this.sync.changes(user.sub, after);
  }
}
