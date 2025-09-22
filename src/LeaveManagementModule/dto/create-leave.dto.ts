import { IsString, IsNotEmpty, IsDateString, IsNumber, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export enum HalfDayType {
  FIRST_HALF = 'first_half',
  SECOND_HALF = 'second_half',
}

export class CreateLeaveDto {
  @IsNumber()
  @IsNotEmpty()
  employeeId: number;

  @IsString()
  @IsNotEmpty()
  leaveType: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsNumber()
  @IsOptional()
  appliedDays?: number;

  @IsBoolean()
  @IsOptional()
  isHalfDay?: boolean;

  @IsEnum(HalfDayType)
  @IsOptional()
  halfDayType?: HalfDayType;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;
}