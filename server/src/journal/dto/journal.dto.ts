import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import type { JournalEntryKind } from '@where-my-books/shared';

export class CreateJournalEntryDto {
  @IsEnum(['note', 'quote']) kind!: JournalEntryKind;
  @IsString() @IsNotEmpty() @MaxLength(5000) body!: string;
  @IsOptional() @IsInt() @Min(1) @Max(100000) page?: number | null;
}

export class UpdateJournalEntryDto {
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @IsNotEmpty() @MaxLength(5000) body?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null) @IsInt() @Min(1) @Max(100000) page?: number | null;
}
