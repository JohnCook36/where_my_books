import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Patch, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { ScanDraftsService } from './scan-drafts.service.js';
import { ConfirmScanDraftsDto, UpdateScanDraftDto } from './scan-drafts.dto.js';
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
  constructor(private readonly catalog: CatalogService, private readonly prisma: PrismaService, private readonly scanDrafts: ScanDraftsService) {}
  @Get('catalog')
  async lookup(@CurrentUser() user: AccessTokenPayload, @Query('isbn') input: string) {
    if (typeof input !== 'string' || input.length > 32) throw new BadRequestException('Введите ISBN');
    this.limit(user.sub);
    const result = await this.catalog.lookup(input);
    const copies = await this.prisma.bookCopy.findMany({ where: { userId: user.sub, edition: { isbn: result.isbn } }, include: { edition: { include: { work: true } } }, take: 100 });
    return { ...result, existingCopies: copies.map((copy) => ({ id: copy.id, title: copy.edition.work.title })) };
  }
  @Get('catalog/search')
  async search(@CurrentUser() user: AccessTokenPayload, @Query('title') title: unknown, @Query('author') author: unknown, @Query('page') page: unknown) {
    if ((title !== undefined && typeof title !== 'string') || (author !== undefined && typeof author !== 'string') || (page !== undefined && (typeof page !== 'string' || !/^[0-9]{1,2}$/.test(page)))) throw new BadRequestException('Некорректные параметры поиска');
    this.limit(user.sub);
    const result = await this.catalog.search({ title: title as string ?? '', author: author as string ?? '', page: page === undefined ? 1 : Number(page) });
    const isbns = [...new Set(result.hits.flatMap((hit) => hit.isbns))];
    const copies = isbns.length ? await this.prisma.bookCopy.findMany({ where: { userId: user.sub, edition: { isbn: { in: isbns } } }, include: { edition: { include: { work: true } } }, take: 300 }) : [];
    return { ...result, hits: result.hits.map((hit) => ({ ...hit, existingCopies: copies.filter((copy) => hit.isbns.includes(copy.edition.isbn ?? '')).map((copy) => ({ id: copy.id, title: copy.edition.work.title, isbn: copy.edition.isbn! })) })) };
  }
  private limit(userId: string) {
    const now = Date.now();
    for (const [key, value] of this.windows) if (now - value.start > 60_000) this.windows.delete(key);
    const window = this.windows.get(userId) ?? { start: now, requests: 0 };
    if (++window.requests > 30) throw new BadRequestException('Не более 30 поисков в минуту. Повторите позже.');
    if (!this.windows.has(userId) && this.windows.size >= 1000) throw new BadRequestException('Каталог занят. Повторите позже.');
    this.windows.set(userId, window);
  }
  @Get('scan-drafts')
  drafts(@CurrentUser() user: AccessTokenPayload) { return this.scanDrafts.list(user.sub); }
  @Get('scan-drafts/:id')
  draft(@CurrentUser() user: AccessTokenPayload, @Param('id', new ParseUUIDPipe()) id: string) { return this.scanDrafts.get(user.sub, id); }
  @Post('scan-drafts')
  addDraft(@CurrentUser() user: AccessTokenPayload, @Body() dto: ScanIsbnDto) { return this.scanDrafts.add(user.sub, dto.isbn); }
  @Patch('scan-drafts/:id')
  updateDraft(@CurrentUser() user: AccessTokenPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateScanDraftDto) { return this.scanDrafts.update(user.sub, id, dto); }
  @Post('scan-drafts/confirm')
  confirmDrafts(@CurrentUser() user: AccessTokenPayload, @Body() dto: ConfirmScanDraftsDto) { return this.scanDrafts.confirm(user.sub, dto.items); }
  @Delete('scan-drafts/:id')
  removeDraft(@CurrentUser() user: AccessTokenPayload, @Param('id', new ParseUUIDPipe()) id: string) { return this.scanDrafts.remove(user.sub, id); }
}
