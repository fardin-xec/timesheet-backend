import { IsDate, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { LeaveStatus, LeaveType } from 'src/entities/leave.entity';

export class CreateLeaveDto {
  @IsInt()
  @Min(1)
  employeeId: number;

  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @IsDate()
  startDate: Date;

  @IsDate()
  endDate: Date;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsEnum(LeaveStatus)
  @IsOptional()
  status: LeaveStatus = LeaveStatus.PENDING;

  @IsOptional()
  @IsInt()
  @Min(1)
  approvedBy?: number;

  @IsNumber()
  @Min(0.5)
  @Max(365)
  appliedDays: number;
}