import { IsIn, IsInt, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ReadingStatus } from '@prisma/client';

export class SyncMutationDto {
  @IsUUID() operationId!: string;
  @IsUUID() copyId!: string;
  @IsISO8601({ strict: true }) baseUpdatedAt!: string;
  @IsIn(['status', 'progress']) kind!: 'status' | 'progress';
  @IsOptional() @IsIn(Object.values(ReadingStatus)) status?: ReadingStatus;
  @IsOptional() @IsInt() @Min(0) @Max(100000) currentPage?: number;
}
