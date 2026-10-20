import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import type { SyncBootstrapResponse, SyncChangesResponse, SyncMutationResult } from '@where-my-books/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { SyncService } from './sync.service.js';
import { SyncMutationDto } from './sync-mutation.dto.js';
import { SyncMutationService } from './sync-mutation.service.js';

@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService, private readonly mutations: SyncMutationService) {}

  @Post('mutations')
  mutate(@CurrentUser() user: AccessTokenPayload, @Body() dto: SyncMutationDto): Promise<SyncMutationResult> {
    return this.mutations.apply(user.sub, dto);
  }

  @Get('bootstrap')
  bootstrap(@CurrentUser() user: AccessTokenPayload): Promise<SyncBootstrapResponse> {
    return this.sync.bootstrap(user.sub);
  }

  @Get('changes')
  changes(@CurrentUser() user: AccessTokenPayload, @Query('after') after: string): Promise<SyncChangesResponse> {
    return this.sync.changes(user.sub, after);
  }
}
