import { IsInt, Max, Min } from 'class-validator';
export class UpdateReadingGoalsDto {
  @IsInt() @Min(1) @Max(500) finishedBooksTarget!: number;
  @IsInt() @Min(10) @Max(10080) weeklyMinutesTarget!: number;
}
