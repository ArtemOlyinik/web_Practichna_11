import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { PartRequestStatus } from '../entities/part-request.entity.js';

export class PartRequestQueryDto {
  @IsOptional()
  @IsEnum(PartRequestStatus)
  status?: PartRequestStatus;

  @IsOptional()
  @IsISO8601()
  updatedAfter?: string;
}
