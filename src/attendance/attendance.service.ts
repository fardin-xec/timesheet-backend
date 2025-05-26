import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import { Attendance, AttendanceStatus } from '../entities/attendances.entity';
import { Employee } from '../entities/employees.entity';
import { Organization } from '../entities/organizations.entity';
import { Leave } from '../entities/leave.entity';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { LeaveStatus } from '../entities/leave.entity';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(Leave)
    private leaveRepository: Repository<Leave>,
  ) {}

  async create(createAttendanceDto: CreateAttendanceDto): Promise<Attendance> {
    const { employeeId, orgId, attendanceDate } = createAttendanceDto;

    const attendanceDateObj = new Date(attendanceDate);
    if (isNaN(attendanceDateObj.getTime())) {
      throw new HttpException('Invalid attendance date', HttpStatus.BAD_REQUEST);
    }

    const employee = await this.employeeRepository.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new HttpException('Employee not found', HttpStatus.NOT_FOUND);
    }

    const organization = await this.organizationRepository.findOne({ where: { orgId } });
    if (!organization) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    const existingAttendance = await this.attendanceRepository.findOne({
      where: { employeeId, attendanceDate: attendanceDateObj },
    });
    if (existingAttendance) {
      throw new HttpException('Attendance record already exists for this employee on this date', HttpStatus.CONFLICT);
    }

    // Check for approved leave
    const leave = await this.leaveRepository.findOne({
      where: {
        employeeId,
        startDate: LessThanOrEqual(attendanceDateObj),
        endDate: MoreThanOrEqual(attendanceDateObj),
        status: LeaveStatus.APPROVED,
      },
    });
    if (leave) {
      createAttendanceDto.status = AttendanceStatus.ON_LEAVE;
    }

    const attendance = this.attendanceRepository.create({
      ...createAttendanceDto,
      employee,
      organization,
    });

    return await this.attendanceRepository.save(attendance);
  }

  async createBulk(createAttendanceDtos: CreateAttendanceDto[]): Promise<Attendance[]> {
    const attendances = await Promise.all(
      createAttendanceDtos.map(async (dto) => {
        const employee = await this.employeeRepository.findOne({ where: { id: dto.employeeId } });
        if (!employee) {
          throw new HttpException(`Employee ${dto.employeeId} not found`, HttpStatus.NOT_FOUND);
        }
        const organization = await this.organizationRepository.findOne({ where: { orgId: dto.orgId } });
        if (!organization) {
          throw new HttpException(`Organization ${dto.orgId} not found`, HttpStatus.NOT_FOUND);
        }
        const attendanceDateObj = new Date(dto.attendanceDate);
        if (isNaN(attendanceDateObj.getTime())) {
          throw new HttpException('Invalid attendance date', HttpStatus.BAD_REQUEST);
        }

        const leave = await this.leaveRepository.findOne({
          where: {
            employeeId: dto.employeeId,
            startDate: LessThanOrEqual(attendanceDateObj),
            endDate: MoreThanOrEqual(attendanceDateObj),
            status: LeaveStatus.APPROVED,
          },
        });
        if (leave) {
          dto.status = AttendanceStatus.ON_LEAVE;
        }
        return this.attendanceRepository.create({ ...dto, employee, organization });
      }),
    );
    return await this.attendanceRepository.save(attendances, { chunk: 1000 });
  }

  async findAllWithFilters(filters: {
    page: number;
    limit: number;
    employeeId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: Attendance[]; total: number }> {
    const { page, limit, employeeId, startDate, endDate } = filters;
    const query = this.attendanceRepository.createQueryBuilder('attendance');

    if (employeeId) {
      query.andWhere('attendance.employeeId = :employeeId', { employeeId });
    }
    if (startDate) {
      query.andWhere('attendance.attendanceDate >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      query.andWhere('attendance.attendanceDate <= :endDate', { endDate: new Date(endDate) });
    }

    query.skip((page - 1) * limit).take(limit);
    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }

  async findOne(id: number): Promise<Attendance | null> {
    try {
      return await this.attendanceRepository.findOne({
        where: { id },
        relations: ['employee', 'organization'],
      });
    } catch (error) {
      console.error('Error finding attendance:', error);
      throw new HttpException('Failed to retrieve attendance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async update(employeeId: number, updateAttendanceDto: UpdateAttendanceDto): Promise<Attendance | null> {
    const today = new Date(); // Current date (should be April 21, 2025)
    today.setUTCHours(0, 0, 0, 0); // Use UTC to avoid timezone offset
    const todayString = today.toISOString().split('T')[0];
    const attendanceDateObj = new Date(todayString);

    const attendance = await this.attendanceRepository.findOne({ where: { employeeId, attendanceDate: attendanceDateObj } });
    if (!attendance) {
      throw new HttpException('Attendance not found', HttpStatus.NOT_FOUND);
    }

    if(updateAttendanceDto.checkOutTime&&attendance.checkInTime===null){
       return attendance;
    }

    const attendanceId = attendance.id;

    // Prevent updating checkInTime if it already exists
    if (attendance.checkInTime && updateAttendanceDto.checkInTime && attendance.checkInTime !== updateAttendanceDto.checkInTime) {
      return attendance;
    }

    return await this.attendanceRepository.manager.transaction(async (manager) => {
      if (employeeId) {
        const employee = await this.employeeRepository.findOne({ where: { id: employeeId } });
        if (!employee) {
          throw new HttpException('Employee not found', HttpStatus.NOT_FOUND);
        }
        attendance.employee = employee;
      }

      // Apply updates from updateAttendanceDto, avoiding overwrite of id
      Object.assign(attendance, updateAttendanceDto);

      // Calculate totalWorkingHours if both checkInTime and checkOutTime are available
      if (attendance.checkInTime && attendance.checkOutTime) {
        const checkIn = new Date(`1970-01-01T${attendance.checkInTime}Z`);
        const checkOut = new Date(`1970-01-01T${attendance.checkOutTime}Z`);
        const diffMs = checkOut.getTime() - checkIn.getTime(); // Difference in milliseconds
        if (diffMs < 0) {
          throw new HttpException('Check-out time cannot be before check-in time', HttpStatus.BAD_REQUEST);
        }
        attendance.totalWorkingHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2)); // Convert to hours with 2 decimal places
      } else {
        attendance.totalWorkingHours = null; // Reset if either time is missing
      }

      // Use named parameter with setParameter
      const updatedAttendance = await manager
        .createQueryBuilder(Attendance, 'attendance')
        .update(Attendance)
        .set(attendance)
        .where('id = :id', { id: attendanceId })
        .execute();

      if (updatedAttendance.affected === 0) {
        throw new HttpException('Concurrent update detected', HttpStatus.CONFLICT);
      }

      return await manager.findOne(Attendance, { where: { id: attendanceId }, relations: ['employee', 'organization'] });
    });
  }

  async updateAttendance(id: number, updateAttendanceDto: UpdateAttendanceDto): Promise<Attendance | null> {

    const attendance = await this.attendanceRepository.findOne({ where: { id } });
    if (!attendance) {
      throw new HttpException('Attendance not found', HttpStatus.NOT_FOUND);
    }


    return await this.attendanceRepository.manager.transaction(async (manager) => {
      if (attendance.employeeId) {
        const employee = await this.employeeRepository.findOne({ where: { id: attendance.employeeId } });
        if (!employee) {
          throw new HttpException('Employee not found', HttpStatus.NOT_FOUND);
        }
        attendance.employee = employee;
      }

      // Apply updates from updateAttendanceDto, avoiding overwrite of id
      Object.assign(attendance, updateAttendanceDto);

      

      // Use named parameter with setParameter
      const updatedAttendance = await manager
        .createQueryBuilder(Attendance, 'attendance')
        .update(Attendance)
        .set(attendance)
        .where('id = :id', { id })
        .execute();

      if (updatedAttendance.affected === 0) {
        throw new HttpException('Concurrent update detected', HttpStatus.CONFLICT);
      }

      return await manager.findOne(Attendance, { where: { id }, relations: ['employee', 'organization'] });
    });
  }

  async remove(id: number): Promise<boolean> {
    try {
      const attendance = await this.attendanceRepository.findOne({ where: { id } });
      if (!attendance) {
        return false;
      }
      await this.attendanceRepository.delete(id);
      return true;
    } catch (error) {
      console.error('Error removing attendance:', error);
      throw new HttpException('Failed to remove attendance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // New method based on EmployeeService reference
  async findByOrganization(orgId: number): Promise<Attendance[]> {
    try {
      return await this.attendanceRepository.find({
        where: { orgId },
        relations: ['employee', 'organization'],
      });
    } catch (error) {
      console.error('Error finding attendances by organization:', error);
      throw new HttpException('Failed to retrieve attendances by organization', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // New method for subordinates' attendance (assuming reportTo relation exists in Attendance)
  async findSubordinatesAttendance(employeeId: number): Promise<Attendance[]> {
    try {
      const subordinates = await this.employeeRepository.find({ where: { reportTo: employeeId } });
      const subordinateIds = subordinates.map((emp) => emp.id);
      if (subordinateIds.length === 0) return [];

      return await this.attendanceRepository.find({
        where: { employeeId: In(subordinateIds) },
        relations: ['employee', 'organization'],
      });
    } catch (error) {
      console.error('Error finding subordinates\' attendance:', error);
      throw new HttpException('Failed to retrieve subordinates\' attendance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // New method for managers' attendance
  async findOnlyManagersAttendance(): Promise<Attendance[]> {
    try {
      const managers = await this.employeeRepository.find({
        where: [
          { designation: In(['Manager', 'Lead', 'Senior', 'Director', 'VP']) },
        ],
      });
      const managerIds = managers.map((emp) => emp.id);
      if (managerIds.length === 0) return [];

      return await this.attendanceRepository.find({
        where: { employeeId: In(managerIds) },
        relations: ['employee', 'organization'],
      });
    } catch (error) {
      console.error('Error finding managers\' attendance:', error);
      if (error.detail) {
        console.error('Database error details:', error.detail);
      }
      throw new HttpException('Failed to retrieve managers\' attendance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // New method to find attendance with leave counts (similar to EmployeeService.findAllWithLeaves)
  async findAllWithLeaves(): Promise<any> {
    try {
      const query = this.attendanceRepository
        .createQueryBuilder('attendance')
        .leftJoin('attendance.employee', 'employee')
        .leftJoin('employee.leaves', 'leaves')
        .select([
          'attendance.id AS "id"',
          'attendance.employeeId AS "employeeId"',
          'attendance.attendanceDate AS "attendanceDate"',
          'attendance.status AS "status"',
          'attendance.checkInTime AS "checkInTime"',
          'attendance.checkOutTime AS "checkOutTime"',
          'attendance.tasksPerformed AS "tasksPerformed"',
          'attendance.orgId AS "orgId"',
        ])
        .addSelect(
          'COALESCE(SUM(CASE WHEN leaves.status = :pending THEN 1 ELSE 0 END), 0)',
          'pendingLeaves'
        )
        .addSelect(
          'COALESCE(SUM(CASE WHEN leaves.status = :approved THEN 1 ELSE 0 END), 0)',
          'approvedLeaves'
        )
        .setParameters({
          pending: LeaveStatus.PENDING,
          approved: LeaveStatus.APPROVED,
        })
        .groupBy('attendance.id')
        .addGroupBy('attendance.employeeId')
        .addGroupBy('attendance.attendanceDate')
        .addGroupBy('attendance.status')
        .addGroupBy('attendance.checkInTime')
        .addGroupBy('attendance.checkOutTime')
        .addGroupBy('attendance.tasksPerformed')
        .addGroupBy('attendance.orgId');

      const attendances = await query.getRawMany();

      return attendances.map(attendance => ({
        id: attendance.id,
        employeeId: attendance.employeeId,
        attendanceDate: attendance.attendanceDate,
        status: attendance.status,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        tasksPerformed: attendance.tasksPerformed,
        orgId: attendance.orgId,
        pendingLeaves: parseInt(attendance.pendingLeaves, 10) || 0,
        approvedLeaves: parseInt(attendance.approvedLeaves, 10) || 0,
      }));
    } catch (error) {
      console.error('Error finding attendances with leaves:', error);
      if (error.detail) {
        console.error('Database error details:', error.detail);
      }
      throw new HttpException('Failed to retrieve attendances with leaves', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}