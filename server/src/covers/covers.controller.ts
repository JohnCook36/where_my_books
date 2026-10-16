import { BadRequestException, Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Post, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsEnum } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { CoverUploadGuard } from './cover-upload.guard.js';
import { CoversService } from './covers.service.js';
import { MAX_UPLOAD_BYTES } from './image-normalizer.js';
class UploadCoverDto { @IsEnum(['gallery', 'camera']) source!: 'gallery' | 'camera' }
@UseGuards(JwtAuthGuard)
@Controller('covers')
export class CoversController {
  constructor(private readonly covers: CoversService) {}
  @Post()
  @UseGuards(CoverUploadGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 1, parts: 2 } }))
  upload(@CurrentUser() user: AccessTokenPayload, @Body() dto: UploadCoverDto, @UploadedFile() file?: { buffer: Buffer; mimetype: string }) {
    if (!file) throw new BadRequestException('Выберите файл обложки');
    return this.covers.upload(user.sub, dto.source, file.buffer, file.mimetype);
  }
  @Get(':id') @Header('Cache-Control', 'private, no-store')
  info(@CurrentUser() user: AccessTokenPayload, @Param('id', new ParseUUIDPipe()) id: string) { return this.covers.info(user.sub, id); }
  @Get(':id/image') @Header('Cache-Control', 'private, no-store') @Header('X-Content-Type-Options', 'nosniff')
  async image(@CurrentUser() user: AccessTokenPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    const asset = await this.covers.image(user.sub, id);
    return new StreamableFile(asset.bytes, { type: 'image/jpeg', length: asset.byteSize, disposition: 'inline' });
  }
  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id', new ParseUUIDPipe()) id: string) { return this.covers.remove(user.sub, id); }
}
