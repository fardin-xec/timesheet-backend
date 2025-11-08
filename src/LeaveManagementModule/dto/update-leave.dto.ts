import { PartialType } from '@nestjs/mapped-types';
import { ApplyLeaveDto } from './create-leave.dto';
import { IsNumber,IsString, IsOptional } from 'class-validator';

export class UpdateLeaveDto extends PartialType(ApplyLeaveDto) {
  @IsNumber()
  @IsOptional()
  approvedBy?: number;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;
}