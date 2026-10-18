import { IsInt, Max, Min } from 'class-validator';
export class FinishReadingSessionDto {
  @IsInt() @Min(0) @Max(100000) endPage!: number;
}
