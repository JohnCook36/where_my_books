import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MaxLength, IsUUID, IsArray, ArrayMaxSize, ValidateIf } from 'class-validator';
import type { ReadingStatus } from '@where-my-books/shared';

export class BookMetadataDto {
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsEnum(['parchment', 'forest', 'burgundy', 'midnight']) coverStyle?: 'parchment' | 'forest' | 'burgundy' | 'midnight';
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsEnum(['automatic', 'catalog', 'custom', 'placeholder']) coverMode?: 'automatic' | 'catalog' | 'custom' | 'placeholder';
  @IsOptional() @IsUUID() coverAssetId?: string | null;
  @IsOptional() @IsString() @MaxLength(2048) automaticCoverUri?: string | null;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @MaxLength(32) isbn?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @MaxLength(500) publisher?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsInt() @Min(1) @Max(3000) publicationYear?: number;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @MaxLength(30) language?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @MaxLength(10000) description?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(500, { each: true }) authors?: string[];
  @IsOptional() @IsString() @MaxLength(2048) coverUri?: string | null;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsEnum(['google_books', 'open_library']) catalogSource?: 'google_books' | 'open_library';
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @MaxLength(200) externalId?: string;
}

export class CreateBookDto extends BookMetadataDto {
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsUUID() clientRequestId?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsUUID() editionId?: string;
  @IsString() @IsNotEmpty() @MaxLength(500) title!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) author!: string;
  @IsInt() @Min(0) @Max(100000) totalPages!: number;
}

export class UpdateBookDto extends BookMetadataDto {
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @IsNotEmpty() @MaxLength(500) title?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @IsNotEmpty() @MaxLength(500) author?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsInt() @Min(0) @Max(100000) totalPages?: number;
}

export class UpdateStatusDto {
  @IsEnum(['want_to_read', 'reading', 'finished', 'dnf']) status!: ReadingStatus;
}

export class UpdateProgressDto {
  @IsInt() @Min(0) currentPage!: number;
}
