import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsObject, IsUUID, Min } from 'class-validator';
import type { ShelfAction } from '@where-my-books/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { ShelvesService } from './shelves.service.js';
class ShelfMutationDto {
  @IsUUID() requestId!: string;
  @IsInt() @Min(0) baseRevision!: number;
  @IsObject() action!: ShelfAction;
}
@UseGuards(JwtAuthGuard)
@Controller('shelves/layout')
export class ShelvesController {
  constructor(private readonly shelves: ShelvesService) {}
  @Get() layout(@CurrentUser() user: AccessTokenPayload) { return this.shelves.layout(user.sub); }
  @Post() mutate(@CurrentUser() user: AccessTokenPayload, @Body() dto: ShelfMutationDto) { return this.shelves.mutate(user.sub, dto); }
}
