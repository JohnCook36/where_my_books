import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { ReadingGoals, ReadingStatsResponse } from '@where-my-books/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { UpdateReadingGoalsDto } from './statistics.dto.js';
import { StatisticsService } from './statistics.service.js';

@UseGuards(JwtAuthGuard)
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly stats: StatisticsService) {}
  @Get()
  overview(@CurrentUser() user: AccessTokenPayload): Promise<ReadingStatsResponse> { return this.stats.overview(user.sub); }

  @Patch('goals')
  goals(@CurrentUser() user: AccessTokenPayload, @Body() dto: UpdateReadingGoalsDto): Promise<ReadingGoals> {
    return this.stats.updateGoals(user.sub, dto);
  }
}
