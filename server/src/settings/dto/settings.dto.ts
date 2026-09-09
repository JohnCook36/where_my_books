import { IsEnum } from 'class-validator';
import type { ProgressDisplayMode } from '@where-my-books/shared';

export class UpdateSettingsDto {
  @IsEnum(['pages', 'percentage'])
  progressDisplayMode!: ProgressDisplayMode;
}
