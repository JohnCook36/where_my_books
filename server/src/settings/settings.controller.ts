import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { UpdateUserSettingsRequest, UserSettingsResponse } from '@where-my-books/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { SettingsService } from './settings.service.js';
import { UpdateSettingsDto } from './dto/settings.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}
  @Get() get(@CurrentUser() user: AccessTokenPayload): Promise<UserSettingsResponse> { return this.settings.get(user.sub); }
  @Patch() update(@CurrentUser() user: AccessTokenPayload, @Body() dto: UpdateSettingsDto): Promise<UserSettingsResponse> { return this.settings.update(user.sub, dto as UpdateUserSettingsRequest); }
}
