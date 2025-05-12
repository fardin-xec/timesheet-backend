import { IsEnum, IsDateString, IsInt, IsString, IsOptional, IsIn } from 'class-validator';
import { AttendanceStatus } from '../../entities/attendances.entity';

export class UpdateAttendanceDto {
  @IsInt()
  @IsOptional()
  employeeId?: number;

  @IsInt()
  @IsOptional()
  orgId?: number;

  @IsDateString()
  @IsOptional()
  attendanceDate?: string;

  @IsEnum(AttendanceStatus)
  @IsOptional()
  status?: AttendanceStatus;

  @IsString()
  @IsOptional()
  checkInTime?: string;

  @IsString()
  @IsOptional()
  checkOutTime?: string;

  @IsString()
  @IsOptional()
  tasksPerformed?: string;
  
  @IsInt()
  @IsOptional()
  totalWorkingHours
}