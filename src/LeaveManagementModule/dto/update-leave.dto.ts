import { IsDate, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { LeaveStatus, LeaveType } from 'src/entities/leave.entity';

export class UpdateLeaveDto {
  @IsOptional()
  @IsEnum(LeaveType)
  leaveType?: LeaveType;

  @IsOptional()
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  approvedBy?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(365)
  appliedDays?: number;
}