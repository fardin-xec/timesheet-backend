import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AttendanceTimeEntry, TimeEntryStatus } from '../entities/attendanceTimeEntry';
import { Attendance, AttendanceStatus } from '../entities/attendances.entity';
import { Employee } from 'src/entities/employees.entity';
import { Leave, LeaveStatus } from 'src/entities/leave.entity';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceTimeEntry)
    private readonly timeEntryRepo: Repository<AttendanceTimeEntry>,

    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,  
    @InjectRepository(Leave)
    private leaveRepository: Repository<Leave>,  ) {}

    /**
   * Get attendance dashboard analytics for a specific date
   * Returns count of present, absent, on leave, half day employees
   */
  async getAttendanceDashboard(orgId: number, date: Date) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Get total employees in organization
    const totalEmployees = await this.employeeRepository.count({
      where: { orgId },
    });

    // Get all attendance records for the date
    const attendanceRecords = await this.attendanceRepo.find({
      where: {
        orgId,
        attendanceDate: targetDate,
      },
      relations: ['employee'],
    });

    // Count by status
    const present = attendanceRecords.filter(
      (a) => a.status === AttendanceStatus.PRESENT
    ).length;

    const onLeave = attendanceRecords.filter(
      (a) => a.status === AttendanceStatus.ON_LEAVE
    ).length;

    const halfDay = attendanceRecords.filter(
      (a) => a.status === AttendanceStatus.HALF_DAY
    ).length;

    // Absent = Total employees - (present + onLeave + halfDay)
    const absent = totalEmployees - (present + onLeave + halfDay);

    // Calculate average working hours
    const totalWorkingHours = attendanceRecords.reduce(
      (sum, record) => sum + Number(record.totalWorkingHours || 0),
      0
    );
    const avgWorkingHours = attendanceRecords.length > 0 
      ? (totalWorkingHours / attendanceRecords.length).toFixed(2) 
      : '0.00';

    return {
      date: targetDate,
      total: totalEmployees,
      present,
      absent: absent > 0 ? absent : 0,
      onLeave,
      halfDay,
      avgWorkingHours: parseFloat(avgWorkingHours),
      attendancePercentage: totalEmployees > 0 
        ? ((present / totalEmployees) * 100).toFixed(2) 
        : '0.00',
    };
  }

  /**
   * Get attendance records for export (date range)
   * Returns detailed attendance data with employee information
   */
  async getAttendanceForExport(
    orgId: number,
    startDate: Date,
    endDate: Date
  ) {
    const queryStart = new Date(startDate);
    const queryEnd = new Date(endDate);
    queryStart.setHours(0, 0, 0, 0);
    queryEnd.setHours(23, 59, 59, 999);

    const attendanceRecords = await this.attendanceRepo.find({
      where: {
        orgId,
        attendanceDate: Between(queryStart, queryEnd),
      },
      relations: ['employee', 'timeEntries'],
      order: {
        attendanceDate: 'DESC',
        employee: { id: 'ASC' },
      },
    });

    // Format data for export
    return attendanceRecords.map((record) => ({
      employeeId: record.employee.id,
      employeeName: record.employee.firstName + record.employee.midName+ record.employee.lastName || 'N/A',
      employeeEmail: record.employee.email || 'N/A',
      date: record.attendanceDate,
      status: record.status,
      totalWorkingHours: Number(record.totalWorkingHours || 0).toFixed(2),
      numberOfSessions: record.timeEntries?.length || 0,
      firstCheckIn: record.timeEntries?.[0]?.startTime || null,
      lastCheckOut: record.timeEntries?.[record.timeEntries.length - 1]?.endTime || null,
      createdAt: record.createdAt,
    }));
  }


  async startTimer(userId: number): Promise<AttendanceTimeEntry> {
    const employee = await this.employeeRepository.findOneBy({userId})
    const active = await this.timeEntryRepo.findOne({
      where: { employeeId: employee.id, status: TimeEntryStatus.ACTIVE },
    });
    if (active) throw new BadRequestException('An active timer already exists.');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance = await this.attendanceRepo.findOne({
      where: {
        employeeId: employee.id,
        orgId: employee.orgId,
        attendanceDate: today,
      },
    });

    if (!attendance) {
      attendance = this.attendanceRepo.create({
        employeeId: employee.id,
        orgId: employee.orgId,
        attendanceDate: today,
        status: AttendanceStatus.PRESENT,
        totalWorkingHours: 0,
      });
      await this.attendanceRepo.save(attendance);
    }

    const entry = this.timeEntryRepo.create({
      attendanceId: attendance.id,
      employeeId: employee.id,
      startTime: new Date(),
      status: TimeEntryStatus.ACTIVE,
    });

    return this.timeEntryRepo.save(entry);
  }

  async stopTimer(userId: number, taskData: Partial<AttendanceTimeEntry>): Promise<AttendanceTimeEntry> {
    const employee = await this.employeeRepository.findOneBy({userId})

    const active = await this.timeEntryRepo.findOne({
      where: { employeeId:employee.id, status: TimeEntryStatus.ACTIVE },
    });

    if (!active) throw new NotFoundException('No active timer found.');

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - active.startTime.getTime()) / (1000 * 60));

    active.endTime = endTime;
    active.durationMinutes = duration;
    active.status = TimeEntryStatus.COMPLETED;
    active.taskDescription = taskData.taskDescription || null;
    active.taskCategory = taskData.taskCategory || null;
    active.projectName = taskData.projectName || null;
    active.estimatedTimeMinutes = taskData.estimatedTimeMinutes || null;
    active.notes = taskData.notes || null;

    await this.timeEntryRepo.save(active);

    // Update totalWorkingHours in Attendance
    const attendance = await this.attendanceRepo.findOneBy({ id: active.attendanceId });
    if (attendance) {
      const totalMinutes = await this.timeEntryRepo
        .createQueryBuilder('e')
        .select('SUM(e.durationMinutes)', 'sum')
        .where('e.attendanceId = :attendanceId', { attendanceId: attendance.id })
        .andWhere('e.durationMinutes IS NOT NULL')
        .getRawOne();

      attendance.totalWorkingHours = +(+(totalMinutes.sum || 0) / 60).toFixed(2);
      await this.attendanceRepo.save(attendance);
    }

    return active;
  }

  async getTodayEntries(userId: number): Promise<AttendanceTimeEntry[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

     const employee = await this.employeeRepository.findOneBy({userId})


    return this.timeEntryRepo.find({
      where: {
        employeeId:employee.id,
        startTime: Between(today, endOfDay),
      },
      order: { startTime: 'ASC' },
    });
  }

  async updateTaskDetails(entryId: number, employeeId: number, updates: Partial<AttendanceTimeEntry>) {
    const entry = await this.timeEntryRepo.findOneBy({ id: entryId, employeeId });
    if (!entry) throw new NotFoundException('Entry not found.');

    // Prevent editing start/end times
    entry.taskDescription = updates.taskDescription ?? entry.taskDescription;
    entry.taskCategory = updates.taskCategory ?? entry.taskCategory;
    entry.projectName = updates.projectName ?? entry.projectName;
    entry.notes = updates.notes ?? entry.notes;
    entry.estimatedTimeMinutes = updates.estimatedTimeMinutes ?? entry.estimatedTimeMinutes;

    return this.timeEntryRepo.save(entry);
  }

  // async autoStopOpenEntries() {
  //   const now = new Date();
  //   const entries = await this.timeEntryRepo.find({
  //     where: { status: TimeEntryStatus.ACTIVE },
  //   });

  //   for (const entry of entries) {
  //     const duration = Math.floor((now.getTime() - entry.startTime.getTime()) / (1000 * 60));

  //     entry.endTime = now;
  //     entry.durationMinutes = duration;
  //     entry.status = TimeEntryStatus.AUTO_STOPPED;

  //     await this.timeEntryRepo.save(entry);

  //     // Recalculate totalWorkingHours
  //     const attendance = await this.attendanceRepo.findOneBy({ id: entry.attendanceId });
  //     if (attendance) {
  //       const totalMinutes = await this.timeEntryRepo
  //         .createQueryBuilder('e')
  //         .select('SUM(e.durationMinutes)', 'sum')
  //         .where('e.attendanceId = :attendanceId', { attendanceId: attendance.id })
  //         .andWhere('e.durationMinutes IS NOT NULL')
  //         .getRawOne();

  //       attendance.totalWorkingHours = +(+(totalMinutes.sum || 0) / 60).toFixed(2);
  //       await this.attendanceRepo.save(attendance);
  //     }
  //   }
  // }

  async getEntriesByDateRange(
  employeeId: number,
  start: Date,
  end?: Date,
): Promise<AttendanceTimeEntry[]> {
  const queryStart = new Date(start);
  const queryEnd = end ? new Date(end) : new Date(start);
  queryStart.setHours(0, 0, 0, 0);
  queryEnd.setHours(23, 59, 59, 999);

  return this.timeEntryRepo.find({
    where: {
      employeeId,
      startTime: Between(queryStart, queryEnd),
    },
    order: { startTime: 'ASC' },
  });
}


 
  
  private async updateAttendanceHours(attendanceId: number): Promise<void> {
    const entries = await this.timeEntryRepo.find({
      where: { attendanceId },
    });

    const totalMinutes = entries.reduce(
      (sum, entry) => sum + (entry.durationMinutes || 0),
      0
    );

    const totalHours = totalMinutes / 60;

    await this.attendanceRepo.update(attendanceId, {
      totalWorkingHours: totalHours,
    });
  }

  /**
   * Get attendance analytics for a specific date
   */
  async getAttendanceAnalytics(orgId: number, date: Date) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Get all employees in organization
    const totalEmployees = await this.employeeRepository.count({
      where: { orgId },
    });

    // Get attendance records for the date
    const attendanceRecords = await this.attendanceRepo.find({
      where: {
        orgId,
        attendanceDate: targetDate,
      },
    });

    // Count by status
    const present = attendanceRecords.filter(
      (a) => a.status === AttendanceStatus.PRESENT
    ).length;

    const onLeave = attendanceRecords.filter(
      (a) => a.status === AttendanceStatus.ON_LEAVE
    ).length;

    const halfDay = attendanceRecords.filter(
      (a) => a.status === AttendanceStatus.HALF_DAY
    ).length;

    const absent = totalEmployees - (present + onLeave + halfDay);

    return {
      total: totalEmployees,
      present,
      absent: absent > 0 ? absent : 0,
      onLeave,
      halfDay,
      date: targetDate,
    };
  }

  /**
   * Get active timer for an employee
   */
  async getActiveTimer(employeeId: number): Promise<AttendanceTimeEntry | null> {
    return this.timeEntryRepo.findOne({
      where: {
        employeeId,
        status: TimeEntryStatus.ACTIVE,
      },
    });
  }

  /**
   * Auto-stop all active timers at midnight (should be called by cron job)
   */
  async autoStopTimers(): Promise<void> {
    const activeTimers = await this.timeEntryRepo.find({
      where: { status: TimeEntryStatus.ACTIVE },
      relations: ['attendance'],
    });

    const midnight = new Date();
    midnight.setHours(23, 59, 59, 999);

    for (const timer of activeTimers) {
      const durationMinutes = Math.floor(
        (midnight.getTime() - timer.startTime.getTime()) / (1000 * 60)
      );

      timer.endTime = midnight;
      timer.durationMinutes = durationMinutes;
      timer.status = TimeEntryStatus.AUTO_STOPPED;

      await this.timeEntryRepo.save(timer);
      await this.updateAttendanceHours(timer.attendanceId);
    }
  }

   /**
   * Get attendance dashboard analytics for a specific date
   * Returns count of present, absent, on leave, half day employees
   */
  async getAllEmployeesAttendance(orgId: number, date: Date) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  // Fetch all employees in the org
  const employees = await this.employeeRepository.find({
    where: { orgId },
  });

  // Fetch attendance records for the date with employee relation
  const attendanceRecords = await this.attendanceRepo.find({
    where: { orgId, attendanceDate: targetDate },
    relations: ['employee'],
  });

  // Create a map of attendance by employeeId for quick lookup
  const attendanceMap = new Map<number, any>();
  attendanceRecords.forEach((record) => {
    attendanceMap.set(record.employeeId, record);
  });

  // Prepare employees data with attendance info
  const employeesWithAttendance = employees.map((emp) => {
    const attendance = attendanceMap.get(emp.id);
    return {
      id: emp.id,
      firstName: emp.firstName,
      midName: emp.midName,
      lastName: emp.lastName,
      email: emp.email,
      department: emp.department,
      jobTitle: emp.jobTitle,
      joiningDate: emp.joiningDate,
      status: attendance ? attendance.status : 'ABSENT',
      totalWorkingHours: attendance ? Number(attendance.totalWorkingHours || 0) : 0,
    };
  });

  // Count present, onLeave, halfDay, absent
  const present = employeesWithAttendance.filter(
    (e) => e.status === AttendanceStatus.PRESENT
  ).length;

  const onLeave = employeesWithAttendance.filter(
    (e) => e.status === AttendanceStatus.ON_LEAVE
  ).length;

  const halfDay = employeesWithAttendance.filter(
    (e) => e.status === AttendanceStatus.HALF_DAY
  ).length;

  const absent = employeesWithAttendance.filter(
    (e) => e.status === 'ABSENT'
  ).length;

  // Calculate average working hours of those who are present/on leave/half day (skip absent)
  const workingEmployees = employeesWithAttendance.filter(
    (e) => e.status !== 'ABSENT'
  );
  const totalWorkingHours = workingEmployees.reduce(
    (sum, e) => sum + e.totalWorkingHours,
    0
  );
  const avgWorkingHours = workingEmployees.length > 0
    ? (totalWorkingHours / workingEmployees.length).toFixed(2)
    : '0.00';

  return {
    employees: employeesWithAttendance,
  };
}
 async getMonthlyLogs(
    userId: number,
    startDate: string,
    endDate: string,
  ) {
    //get Employee details
    const employee = await this.employeeRepository.findOneBy({userId})

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (endDateOnly > today) {
      throw new BadRequestException('End date cannot be in the future');
    }

    if (start > end) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Get approved leaves in the date range
    const leaves = await this.leaveRepository.find({
      where: {
        employeeId:employee.id,
        status: LeaveStatus.APPROVED,
        startDate: Between(start, end),
      },
    });

    // Create a map of leave dates
    const leaveDatesMap = new Map<string, Leave>();
    leaves.forEach((leave) => {
      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);
      
      for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        leaveDatesMap.set(dateKey, leave);
      }
    });

    // Get all attendance records in the range
   const attendances = await this.attendanceRepo.find({
  where: {
    employeeId: employee.id,
    orgId: employee.orgId,
    attendanceDate: Between(start, end),
  },
  relations: ['timeEntries'],
  order: { 
    attendanceDate: 'DESC',
    timeEntries: {
      // Specify the field you want to sort by in timeEntries
      createdAt: 'ASC', // or whichever field makes sense for your use case
      // Examples: startTime: 'ASC', timestamp: 'ASC', id: 'ASC'
    }
  },
});

    // Create attendance map
    const attendanceMap = new Map<string, Attendance>();
    attendances.forEach((att) => {
      const dateKey = new Date(att.attendanceDate).toISOString().split('T')[0];
      attendanceMap.set(dateKey, att);
    });

    // Generate daily logs for the entire date range
    const dailyLogs = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
      
      let status: string;
      let totalWorkingHours = 0;
      let firstStartTime: Date | null = null;
      let lastEndTime: Date | null = null;
      let timeEntries: AttendanceTimeEntry[] = [];

      // Check if it's a weekend (Friday or Saturday)
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        status = 'week_off';
      }
      // Check if on approved leave
      else if (leaveDatesMap.has(dateKey)) {
        const leave = leaveDatesMap.get(dateKey);
        status = leave.isHalfDay ? 'half_day' : 'on_leave';
        
        // If half day and has attendance, include working hours
        if (leave.isHalfDay && attendanceMap.has(dateKey)) {
          const attendance = attendanceMap.get(dateKey);
          totalWorkingHours = Number(attendance.totalWorkingHours);
          timeEntries = attendance.timeEntries || [];
          
          if (timeEntries.length > 0) {
            firstStartTime = timeEntries[0].startTime;
            const lastEntry = timeEntries[timeEntries.length - 1];
            lastEndTime = lastEntry.endTime;
          }
        }
      }
      // Check if has attendance
      else if (attendanceMap.has(dateKey)) {
        const attendance = attendanceMap.get(dateKey);
        status = attendance.status;
        totalWorkingHours = Number(attendance.totalWorkingHours);
        timeEntries = attendance.timeEntries || [];
        
        if (timeEntries.length > 0) {
          firstStartTime = timeEntries[0].startTime;
          const lastEntry = timeEntries[timeEntries.length - 1];
          lastEndTime = lastEntry.endTime;
        }
      }
      // No attendance record and not a weekend or leave
      else if (currentDate < today) {
        status = 'absent';
      }
      // Future date
      else {
        status = 'not_marked';
      }

      dailyLogs.push({
        date: dateKey,
        dayOfWeek: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
        status,
        totalWorkingHours: totalWorkingHours.toFixed(2),
        firstStartTime,
        lastEndTime,
        timeEntries: timeEntries.map(entry => ({
          id: entry.id,
          startTime: entry.startTime,
          endTime: entry.endTime,
          durationMinutes: entry.durationMinutes,
          status: entry.status,
          taskDescription: entry.taskDescription,
          taskCategory: entry.taskCategory,
          projectName: entry.projectName,
          notes: entry.notes,
        })),
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate summary statistics
    const summary = {
      totalDays: dailyLogs.length,
      presentDays: dailyLogs.filter(d => d.status === 'present').length,
      absentDays: dailyLogs.filter(d => d.status === 'absent').length,
      leaveDays: dailyLogs.filter(d => d.status === 'on_leave').length,
      halfDays: dailyLogs.filter(d => d.status === 'half_day').length,
      weekOffs: dailyLogs.filter(d => d.status === 'week_off').length,
      totalHoursWorked: dailyLogs.reduce((sum, d) => sum + parseFloat(d.totalWorkingHours), 0).toFixed(2),
    };

    return {
      summary,
      dailyLogs,
    };
  }

   async getEmployeeMonthlyLogs(
    employeeId: number,
    startDate: string,
    endDate: string,
  ) {
    //get Employee details
    const employee = await this.employeeRepository.findOneBy({id:employeeId})
    if(!employee){
      throw new BadRequestException('Invalid employee Id');
    }
    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (endDateOnly > today) {
      throw new BadRequestException('End date cannot be in the future');
    }

    if (start > end) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Get approved leaves in the date range
    const leaves = await this.leaveRepository.find({
      where: {
        employeeId:employee.id,
        status: LeaveStatus.APPROVED,
        startDate: Between(start, end),
      },
    });

    // Create a map of leave dates
    const leaveDatesMap = new Map<string, Leave>();
    leaves.forEach((leave) => {
      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);
      
      for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        leaveDatesMap.set(dateKey, leave);
      }
    });

    // Get all attendance records in the range
   const attendances = await this.attendanceRepo.find({
  where: {
    employeeId: employee.id,
    orgId: employee.orgId,
    attendanceDate: Between(start, end),
  },
  relations: ['timeEntries'],
  order: { 
    attendanceDate: 'DESC',
    timeEntries: {
      // Specify the field you want to sort by in timeEntries
      createdAt: 'ASC', // or whichever field makes sense for your use case
      // Examples: startTime: 'ASC', timestamp: 'ASC', id: 'ASC'
    }
  },
});

    // Create attendance map
    const attendanceMap = new Map<string, Attendance>();
    attendances.forEach((att) => {
      const dateKey = new Date(att.attendanceDate).toISOString().split('T')[0];
      attendanceMap.set(dateKey, att);
    });

    // Generate daily logs for the entire date range
    const dailyLogs = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
      
      let status: string;
      let totalWorkingHours = 0;
      let firstStartTime: Date | null = null;
      let lastEndTime: Date | null = null;
      let timeEntries: AttendanceTimeEntry[] = [];

      // Check if it's a weekend (Friday or Saturday)
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        status = 'week_off';
      }
      // Check if on approved leave
      else if (leaveDatesMap.has(dateKey)) {
        const leave = leaveDatesMap.get(dateKey);
        status = leave.isHalfDay ? 'half_day' : 'on_leave';
        
        // If half day and has attendance, include working hours
        if (leave.isHalfDay && attendanceMap.has(dateKey)) {
          const attendance = attendanceMap.get(dateKey);
          totalWorkingHours = Number(attendance.totalWorkingHours);
          timeEntries = attendance.timeEntries || [];
          
          if (timeEntries.length > 0) {
            firstStartTime = timeEntries[0].startTime;
            const lastEntry = timeEntries[timeEntries.length - 1];
            lastEndTime = lastEntry.endTime;
          }
        }
      }
      // Check if has attendance
      else if (attendanceMap.has(dateKey)) {
        const attendance = attendanceMap.get(dateKey);
        status = attendance.status;
        totalWorkingHours = Number(attendance.totalWorkingHours);
        timeEntries = attendance.timeEntries || [];
        
        if (timeEntries.length > 0) {
          firstStartTime = timeEntries[0].startTime;
          const lastEntry = timeEntries[timeEntries.length - 1];
          lastEndTime = lastEntry.endTime;
        }
      }
      // No attendance record and not a weekend or leave
      else if (currentDate < today) {
        status = 'absent';
      }
      // Future date
      else {
        status = 'not_marked';
      }

      dailyLogs.push({
        date: dateKey,
        dayOfWeek: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
        status,
        totalWorkingHours: totalWorkingHours.toFixed(2),
        firstStartTime,
        lastEndTime,
        timeEntries: timeEntries.map(entry => ({
          id: entry.id,
          startTime: entry.startTime,
          endTime: entry.endTime,
          durationMinutes: entry.durationMinutes,
          status: entry.status,
          taskDescription: entry.taskDescription,
          taskCategory: entry.taskCategory,
          projectName: entry.projectName,
          notes: entry.notes,
        })),
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate summary statistics
    const summary = {
      totalDays: dailyLogs.length,
      presentDays: dailyLogs.filter(d => d.status === 'present').length,
      absentDays: dailyLogs.filter(d => d.status === 'absent').length,
      leaveDays: dailyLogs.filter(d => d.status === 'on_leave').length,
      halfDays: dailyLogs.filter(d => d.status === 'half_day').length,
      weekOffs: dailyLogs.filter(d => d.status === 'week_off').length,
      totalHoursWorked: dailyLogs.reduce((sum, d) => sum + parseFloat(d.totalWorkingHours), 0).toFixed(2),
    };

    return {
      summary,
      dailyLogs,
    };
  }

  async getActiveTimerByUserId(userId: number): Promise<AttendanceTimeEntry | null> {
  const employee = await this.employeeRepository.findOneBy({ userId });
  
  if (!employee) {
    return null;
  }

  return this.timeEntryRepo.findOne({
    where: {
      employeeId: employee.id,
      status: TimeEntryStatus.ACTIVE,
    },
    order: {
      startTime: 'DESC',
    },
  });
}

/**
 * Get active timer with elapsed time calculation
 */
async getActiveTimerWithElapsed(userId: number) {
  const activeTimer = await this.getActiveTimerByUserId(userId);
  
  if (!activeTimer) {
    return {
      isActive: false,
      entry: null,
      elapsedSeconds: 0,
      elapsedMinutes: 0,
    };
  }

  const elapsedMs = Date.now() - new Date(activeTimer.startTime).getTime();
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));

  return {
    isActive: true,
    entry: activeTimer,
    elapsedSeconds,
    elapsedMinutes,
    startTime: activeTimer.startTime,
  };
}

}
