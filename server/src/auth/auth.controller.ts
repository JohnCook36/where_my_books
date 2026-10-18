import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { AccountSessionsResponse, AuthResponse, CurrentUserResponse, RefreshResponse } from '@where-my-books/shared';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AccessTokenPayload } from './auth.types.js';
import { LoginDto, RefreshDto, RegisterDto, PasswordResetRequestDto, PasswordResetConfirmDto } from './dto/auth.dto.js';
import { AuthRateGuard } from './auth-rate.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @UseGuards(AuthRateGuard)
  @Post('register') register(@Body() dto: RegisterDto): Promise<AuthResponse> { return this.auth.register(dto); }
  @UseGuards(AuthRateGuard)
  @Post('login') login(@Body() dto: LoginDto): Promise<AuthResponse> { return this.auth.login(dto); }
  @UseGuards(AuthRateGuard)
  @Post('refresh') refresh(@Body() dto: RefreshDto): Promise<RefreshResponse> { return this.auth.refresh(dto); }
  @UseGuards(AuthRateGuard)
  @Post('password-reset/request')
  @HttpCode(204)
  passwordResetRequest(@Body() dto: PasswordResetRequestDto): Promise<void> { return this.auth.requestPasswordReset(dto.email); }
  @UseGuards(AuthRateGuard)
  @Post('password-reset/confirm')
  @HttpCode(204)
  passwordResetConfirm(@Body() dto: PasswordResetConfirmDto): Promise<void> { return this.auth.resetPassword(dto.token, dto.newPassword); }
  @Post('logout') logout(@Body() dto: RefreshDto): Promise<void> { return this.auth.logout(dto.refreshToken); }
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  sessions(@CurrentUser() user: AccessTokenPayload): Promise<AccountSessionsResponse> {
    return this.auth.listSessions(user.sub, user.sessionId);
  }
  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:sessionId')
  @HttpCode(204)
  revokeSession(@CurrentUser() user: AccessTokenPayload, @Param('sessionId', new ParseUUIDPipe()) sessionId: string): Promise<void> {
    return this.auth.revokeSession(user.sub, sessionId, user.sessionId);
  }
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(204)
  logoutAll(@CurrentUser() user: AccessTokenPayload): Promise<void> { return this.auth.revokeAllSessions(user.sub); }
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AccessTokenPayload): Promise<CurrentUserResponse> { return { user: await this.auth.getUser(user.sub) }; }
}
