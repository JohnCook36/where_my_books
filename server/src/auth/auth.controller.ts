import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthResponse, CurrentUserResponse, RefreshResponse } from '@where-my-books/shared';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AccessTokenPayload } from './auth.types.js';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register') register(@Body() dto: RegisterDto): Promise<AuthResponse> { return this.auth.register(dto); }
  @Post('login') login(@Body() dto: LoginDto): Promise<AuthResponse> { return this.auth.login(dto); }
  @Post('refresh') refresh(@Body() dto: RefreshDto): Promise<RefreshResponse> { return this.auth.refresh(dto); }
  @Post('logout') logout(@Body() dto: RefreshDto): Promise<void> { return this.auth.logout(dto.refreshToken); }
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AccessTokenPayload): Promise<CurrentUserResponse> { return { user: await this.auth.getUser(user.sub) }; }
}
