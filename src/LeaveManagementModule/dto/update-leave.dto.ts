import { PartialType } from '@nestjs/mapped-types';
import { CreateLeaveDto } from './create-leave.dto';
import { IsNumber,IsString, IsOptional } from 'class-validator';

export class UpdateLeaveDto extends PartialType(CreateLeaveDto) {
  @IsNumber()
  @IsOptional()
  approvedBy?: number;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;
}