import { IsEnum, IsDateString, IsInt, IsString, IsOptional } from 'class-validator';
import { AttendanceStatus } from '../../entities/attendances.entity';

export class CreateAttendanceDto {
  @IsInt()
  employeeId: number;

  @IsInt()
  orgId: number;

  @IsDateString()
  attendanceDate: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsString()
  @IsOptional()
  checkInTime?: string;

  @IsString()
  @IsOptional()
  checkOutTime?: string;

  @IsString()
  @IsOptional()
  tasksPerformed?: string;
}