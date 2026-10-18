import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { LibrarySearchSort, ReadingStatus } from '@where-my-books/shared';

export class SearchBooksDto {
  @IsOptional() @IsString() @MaxLength(200) query?: string;
  @IsOptional() @IsEnum(['want_to_read', 'reading', 'finished', 'dnf']) status?: ReadingStatus;
  @IsOptional() @IsEnum(['added', 'updated', 'title', 'year']) sort?: LibrarySearchSort;
  @IsOptional() @IsEnum(['asc', 'desc']) order?: 'asc' | 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}
