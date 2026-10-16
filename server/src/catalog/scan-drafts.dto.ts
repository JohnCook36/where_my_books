import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsObject, IsString, IsUUID, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { BookMetadataDto } from '../books/dto/books.dto.js';

export class ScanReviewPayloadDto extends BookMetadataDto {
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @MaxLength(500) title?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @MaxLength(500) author?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsInt() @Min(0) @Max(100000) totalPages?: number;
}
export class UpdateScanDraftDto {
  @IsInt() @Min(0) baseRevision!: number;
  @IsBoolean() reviewed!: boolean;
  @IsObject() @ValidateNested() @Type(() => ScanReviewPayloadDto) payload!: ScanReviewPayloadDto;
}
export class ConfirmScanItemDto {
  @IsUUID() id!: string;
  @IsInt() @Min(0) revision!: number;
}
export class ConfirmScanDraftsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ConfirmScanItemDto) items!: ConfirmScanItemDto[];
}
