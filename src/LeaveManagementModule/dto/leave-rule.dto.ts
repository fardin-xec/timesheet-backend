import { IsEnum, IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';
import { LeaveType } from '../../entities/leave.entity';
import { Gender } from '../../entities/employees.entity';

export class CreateLeaveRuleDto {
  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @IsNumber()
  @Min(0)
  maxAllowed: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  carryForwardMax?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  accrualRate?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsEnum(Gender)
  @IsOptional()
  applicableGender?: Gender;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minTenureMonths?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  advanceNoticeDays?: number;

  @IsBoolean()
  @IsOptional()
  requiresDocument?: boolean;
}

export class UpdateLeaveRuleDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxAllowed?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  carryForwardMax?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  accrualRate?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minTenureMonths?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  advanceNoticeDays?: number;

  @IsBoolean()
  @IsOptional()
  requiresDocument?: boolean;
}
