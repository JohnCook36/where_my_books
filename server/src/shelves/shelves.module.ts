import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma.service.js';
import { ShelvesController } from './shelves.controller.js';
import { ShelvesService } from './shelves.service.js';
@Module({ imports: [AuthModule], controllers: [ShelvesController], providers: [PrismaService, ShelvesService] })
export class ShelvesModule {}
