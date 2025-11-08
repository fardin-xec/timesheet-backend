// src/dto/leave.dto.ts
import { IsEnum, IsDateString, IsString, IsOptional, IsBoolean, IsNumber, ValidateIf, IsNotEmpty } from 'class-validator';
import { LeaveType, LeaveStatus, HalfDayType } from '../../entities/leave.entity';

export class ApplyLeaveDto {
  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsBoolean()
  @IsOptional()
  isHalfDay?: boolean;

  @IsEnum(HalfDayType)
  @IsOptional()
  @ValidateIf(o => o.isHalfDay === true)
  halfDayType?: HalfDayType;

  @IsString()
  @IsOptional()
  @ValidateIf(o => o.leaveType === LeaveType.EMERGENCY)
  documentId?: string;
}

export class UpdateLeaveDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsBoolean()
  @IsOptional()
  isHalfDay?: boolean;

  @IsEnum(HalfDayType)
  @IsOptional()
  halfDayType?: HalfDayType;

  @IsString()
  @IsOptional()
  documentId?: string;
}

export class ApproveRejectLeaveDto {
  @IsEnum(LeaveStatus)
  status: LeaveStatus;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class LeaveFilterDto {
  @IsEnum(LeaveType)
  @IsOptional()
  leaveType?: LeaveType;

  @IsEnum(LeaveStatus)
  @IsOptional()
  status?: LeaveStatus;

  @IsNumber()
  @IsOptional()
  employeeId?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}