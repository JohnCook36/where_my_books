import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import type { ReadingStatus } from '@where-my-books/shared';

export class CreateBookDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsNotEmpty() author!: string;
  @IsInt() @Min(1) @Max(100000) totalPages!: number;
}

export class UpdateBookDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsString() @IsNotEmpty() author?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100000) totalPages?: number;
}

export class UpdateStatusDto {
  @IsEnum(['want_to_read', 'reading', 'finished', 'dnf']) status!: ReadingStatus;
}

export class UpdateProgressDto {
  @IsInt() @Min(0) currentPage!: number;
}
