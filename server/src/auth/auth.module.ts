import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { AuthRateGuard } from './auth-rate.guard.js';
import { PasswordResetDelivery } from './password-reset-delivery.js';

@Module({
  imports: [JwtModule.registerAsync({ imports: [ConfigModule], inject: [ConfigService], useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('JWT_ACCESS_SECRET') }) })],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, AuthRateGuard, PasswordResetDelivery, PrismaService],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
