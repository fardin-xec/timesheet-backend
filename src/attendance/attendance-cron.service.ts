import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Attendance } from '../entities/attendances.entity';
import { Employee } from '../entities/employees.entity';
import { Leave } from '../entities/leave.entity';
import { AttendanceStatus } from '../entities/attendances.entity';
import { LeaveStatus } from '../entities/leave.entity';

@Injectable()
export class AttendanceCronService {
  private readonly logger = new Logger(AttendanceCronService.name);

  constructor(
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(Leave)
    private leaveRepository: Repository<Leave>,
  ) {}
  // CronExpression.EVERY_DAY_AT_1AM
  // "* * * * *"
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'createDailyAttendance' })
  async createDailyAttendance() {
    this.logger.log('Starting daily attendance creation cron job');
    const today = new Date(); // Current date (should be April 21, 2025)
    today.setUTCHours(0, 0, 0, 0); // Use UTC to avoid timezone offset
    this.logger.debug(`Raw today date: ${today.toISOString()}`); // Debug log
    const todayString = today.toISOString().split('T')[0];
    const dayOfWeek = today.getUTCDay(); // Use UTC day to avoid local timezone issues

    // Skip if today is Friday (5) or Saturday (6) in UTC
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      this.logger.log(`Skipping attendance creation for ${todayString} as it is a Friday or Saturday (UTC)`);
      return;
    }

    try {
      // Fetch all employees with their organization
      const employees = await this.employeeRepository.find({ relations: ['organization'] });
      this.logger.log(`Found ${employees.length} employees`);

      // Process employees in batches
      const batchSize = 1000;
      for (let i = 0; i < employees.length; i += batchSize) {
        const batch = employees.slice(i, i + batchSize);
        const attendanceRecords: Partial<Attendance>[] = [];

        for (const employee of batch) {
          if (!employee.orgId) {
            this.logger.warn(`Employee ${employee.id} has no organization, skipping`);
            continue;
          }
          const attendanceDateObj = new Date(todayString); // Should be April 21, 2025
          this.logger.debug(`Attendance date for employee ${employee.id}: ${attendanceDateObj.toISOString()}`); // Debug log

          if (isNaN(attendanceDateObj.getTime())) {
            throw new Error('Invalid attendance date');
          }

          // Check for existing attendance record
          const existingAttendance = await this.attendanceRepository.findOne({
            where: { employeeId: employee.id, attendanceDate: attendanceDateObj },
          });
          if (existingAttendance) {
            this.logger.debug(`Attendance already exists for employee ${employee.id} on ${todayString}`);
            continue;
          }

          // Check for approved leave
          const leave = await this.leaveRepository.findOne({
            where: {
              employeeId: employee.id,
              startDate: LessThanOrEqual(today),
              endDate: MoreThanOrEqual(today),
              status: LeaveStatus.APPROVED,
            },
          });

          const attendanceRecord: Partial<Attendance> = {
            employeeId: employee.id,
            orgId: employee.orgId,
            attendanceDate: attendanceDateObj, // Use Date object directly
            status: leave ? AttendanceStatus.ON_LEAVE : null,
          };

          attendanceRecords.push(attendanceRecord);
        }

        // Save batch of attendance records
        if (attendanceRecords.length > 0) {
          await this.attendanceRepository.save(attendanceRecords, { chunk: 100 });
          this.logger.log(`Created ${attendanceRecords.length} attendance records in batch ${i / batchSize + 1}`);
        }
      }

      this.logger.log('Daily attendance creation cron job completed');
    } catch (error) {
      this.logger.error(`Error in daily attendance cron job: ${error.message}`, error.stack);
    }
  }
}