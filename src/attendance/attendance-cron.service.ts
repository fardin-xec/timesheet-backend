import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Attendance } from '../entities/attendances.entity';
import { Employee } from '../entities/employees.entity';
import { Leave } from '../entities/leave.entity';
import { AttendanceStatus } from '../entities/attendances.entity';
import { LeaveStatus } from '../entities/leave.entity';
import { AttendanceService } from './attendance.service';

@Injectable()
export class AttendanceCronService {
  private readonly logger = new Logger(AttendanceCronService.name);

  constructor(
        private attendanceService: AttendanceService,
    
  ) {}
  // CronExpression.EVERY_DAY_AT_1AM
  // "* * * * *"
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'createDailyAttendance' })
  async createDailyAttendance() {
    await this.attendanceService.autoStopTimers();
  }
}