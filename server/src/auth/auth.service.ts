import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type { AuthResponse, AuthUser, RefreshResponse } from '@where-my-books/shared';
import type { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto.js';
import type { AccessTokenPayload } from './auth.types.js';

const REFRESH_DAYS = 30;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly config: ConfigService) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email is already registered');
    const user = await this.prisma.user.create({ data: { email, passwordHash: await argon2.hash(dto.password), settings: { create: {} } } });
    return this.issueSession(user.id, user.email, user.createdAt);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) throw new UnauthorizedException('Invalid email or password');
    return this.issueSession(user.id, user.email, user.createdAt);
  }

  async refresh(dto: RefreshDto): Promise<RefreshResponse> {
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: hashToken(dto.refreshToken), }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new UnauthorizedException('Invalid or expired refresh token');
    const result = await this.createTokens(session.user.id, session.user.email, session.user.createdAt);
    await this.prisma.$transaction([
      this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } }),
      this.prisma.session.create({ data: { userId: session.user.id, refreshTokenHash: hashToken(result.refreshToken), expiresAt: this.refreshExpiry() } }),
    ]);
    return result;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async getUser(id: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UnauthorizedException('User not found');
    return { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() };
  }

  private async issueSession(id: string, email: string, createdAt: Date): Promise<AuthResponse> {
    const tokens = await this.createTokens(id, email, createdAt);
    await this.prisma.session.create({ data: { userId: id, refreshTokenHash: hashToken(tokens.refreshToken), expiresAt: this.refreshExpiry() } });
    return { user: { id, email, createdAt: createdAt.toISOString() }, ...tokens };
  }

  private async createTokens(id: string, email: string, _createdAt: Date): Promise<RefreshResponse> {
    const sessionId = randomBytes(16).toString('hex');
    const payload: AccessTokenPayload = { sub: id, email, sessionId };
    const accessToken = await this.jwt.signAsync(payload, { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '15m' });
    return { accessToken, refreshToken: randomBytes(48).toString('base64url') };
  }

  private refreshExpiry() { const date = new Date(); date.setDate(date.getDate() + REFRESH_DAYS); return date; }
}
