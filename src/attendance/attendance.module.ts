import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Attendance } from '../entities/attendances.entity';
import { Employee } from '../entities/employees.entity';
import { Organization } from '../entities/organizations.entity';
import { Leave } from '../entities/leave.entity';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceCronService } from './attendance-cron.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance, Employee, Organization, Leave]),
    ScheduleModule.forRoot(),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceCronService],
  exports: [AttendanceService],
})
export class AttendanceModule {}