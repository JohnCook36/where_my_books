import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { isbn13 } from '@where-my-books/shared';
import { CatalogService } from './catalog.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma.service.js';

class ScanIsbnDto { @IsString() @MaxLength(32) isbn!: string }

@UseGuards(JwtAuthGuard)
@Controller()
export class CatalogController {
  private readonly windows = new Map<string, { start: number; requests: number }>();
  constructor(private readonly catalog: CatalogService, private readonly prisma: PrismaService) {}
  @Get('catalog')
  async lookup(@CurrentUser() user: AccessTokenPayload, @Query('isbn') input: string) {
    if (typeof input !== 'string' || input.length > 32) throw new BadRequestException('Введите ISBN');
    const now = Date.now();
    for (const [key, value] of this.windows) if (now - value.start > 60_000) this.windows.delete(key);
    const window = this.windows.get(user.sub) ?? { start: now, requests: 0 };
    if (++window.requests > 30) throw new BadRequestException('Не более 30 поисков в минуту. Повторите позже.');
    this.windows.set(user.sub, window);
    const result = await this.catalog.lookup(input);
    const copies = await this.prisma.bookCopy.findMany({ where: { userId: user.sub, edition: { isbn: result.isbn } }, include: { edition: { include: { work: true } } }, take: 100 });
    return { ...result, existingCopies: copies.map((copy) => ({ id: copy.id, title: copy.edition.work.title })) };
  }
  @Get('scan-drafts')
  async drafts(@CurrentUser() user: AccessTokenPayload) {
    return { drafts: await this.prisma.scanDraft.findMany({ where: { userId: user.sub }, orderBy: { createdAt: 'asc' } }) };
  }
  @Post('scan-drafts')
  async addDraft(@CurrentUser() user: AccessTokenPayload, @Body() dto: ScanIsbnDto) {
    const isbn = isbn13(dto.isbn);
    if (!isbn) throw new BadRequestException('Некорректный ISBN');
    // Serialize per-user staging limit + dedup across devices.
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.sub}))`;
      const existing = await tx.scanDraft.findUnique({ where: { userId_isbn: { userId: user.sub, isbn } } });
      if (existing) return existing;
      if (await tx.scanDraft.count({ where: { userId: user.sub } }) >= 50) throw new BadRequestException('В очереди уже 50 книг. Подтвердите их перед продолжением.');
      return tx.scanDraft.create({ data: { userId: user.sub, isbn } });
    });
  }
  @Delete('scan-drafts/:id')
  async removeDraft(@CurrentUser() user: AccessTokenPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.prisma.scanDraft.deleteMany({ where: { id, userId: user.sub } });
    return { removed: true };
  }
}
