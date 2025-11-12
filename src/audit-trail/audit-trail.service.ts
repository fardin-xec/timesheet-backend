import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditTrail, AuditTrailAction } from '../entities/audit-trail.entity';
import { Employee, EmployeeStatus } from '../entities/employees.entity';

export interface CreateAuditTrailDto {
  action: AuditTrailAction;
  employeeId: number;
  employeeEmployeeId: string;
  employeeName: string;
  employeeEmail: string;
  changes?: Record<string, { oldValue: any; newValue: any }>;
  reason?: string;
  previousStatus?: string;
  newStatus?: string;
  editedBy: number;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditTrailService {
  constructor(
    @InjectRepository(AuditTrail)
    private auditTrailRepository: Repository<AuditTrail>,
  ) {}

  async create(data: CreateAuditTrailDto): Promise<AuditTrail> {
    const auditTrail = this.auditTrailRepository.create({
      ...data,
      changes: data.changes ? JSON.stringify(data.changes) : null,
      actionDate: new Date(),
    });

    return this.auditTrailRepository.save(auditTrail);
  }

  async logEmployeeCreation(
    employee: Employee,
    payloadUserId: number,
  ): Promise<AuditTrail> {
    return this.create({
      action: AuditTrailAction.CREATED,
      employeeId: employee.id,
      employeeEmployeeId: employee.employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeEmail: employee.email,
      editedBy: payloadUserId,
    });
  }

  async logEmployeeUpdate(
    employee: Employee,
    oldEmployee: Partial<Employee>,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditTrail> {
    const changes: Record<string, { oldValue: any; newValue: any }> = {};

    const fieldsToCheck = [
      'firstName',
      'midName',
      'lastName',
      'phone',
      'designation',
      'department',
      'jobTitle',
      'status',
      'ctc',
      'currency',
      'employmentType',
      'joiningDate',
      'dob',
      'gender',
      'address',
      'isProbation',
      'probationPeriod',
      'location',
      'bio',
    ];

    fieldsToCheck.forEach((field) => {
      if (oldEmployee[field] !== employee[field]) {
        changes[field] = {
          oldValue: oldEmployee[field] || null,
          newValue: employee[field] || null,
        };
      }
    });

    return this.create({
      action: AuditTrailAction.UPDATED,
      employeeId: employee.id,
      employeeEmployeeId: employee.employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeEmail: employee.email,
      changes,
      editedBy: userId,
      ipAddress,
      userAgent,
    });
  }

  async logEmployeeStatusChange(
    employee: Employee,
    previousStatus: EmployeeStatus,
    newStatus: EmployeeStatus,
    reason: string,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditTrail> {
    return this.create({
      action:
        newStatus === EmployeeStatus.INACTIVE
          ? AuditTrailAction.MARKED_INACTIVE
          : AuditTrailAction.MARKED_ACTIVE,
      employeeId: employee.id,
      employeeEmployeeId: employee.employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeEmail: employee.email,
      previousStatus,
      newStatus,
      reason,
      editedBy: userId,
      ipAddress,
      userAgent,
    });
  }

  async logEmployeeDeletion(
    employee: Employee,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditTrail> {
    return this.create({
      action: AuditTrailAction.DELETED,
      employeeId: employee.id,
      employeeEmployeeId: employee.employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeEmail: employee.email,
      editedBy: userId,
      ipAddress,
      userAgent,
    });
  }

  async findAll(filters?: {
    employeeId?: number;
    action?: AuditTrailAction;
    editedBy?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AuditTrail[]> {
    let query = this.auditTrailRepository.createQueryBuilder('auditTrail');

    if (filters) {
      if (filters.employeeId) {
        query = query.where('auditTrail.employeeId = :employeeId', {
          employeeId: filters.employeeId,
        });
      }

      if (filters.action) {
        query = query.andWhere('auditTrail.action = :action', {
          action: filters.action,
        });
      }

      if (filters.editedBy) {
        query = query.andWhere('auditTrail.editedBy = :editedBy', {
          editedBy: filters.editedBy,
        });
      }

      if (filters.startDate && filters.endDate) {
        query = query.andWhere(
          'auditTrail.actionDate BETWEEN :startDate AND :endDate',
          {
            startDate: filters.startDate,
            endDate: filters.endDate,
          },
        );
      }
    }

    return query.orderBy('auditTrail.actionDate', 'DESC').getMany();
  }

  async findByEmployee(employeeId: number): Promise<AuditTrail[]> {
    return this.auditTrailRepository.find({
      where: { employeeId },
      relations: ['editedByUser'],
      order: { actionDate: 'DESC' },
    });
  }

  async findByUser(userId: number): Promise<AuditTrail[]> {
    return this.auditTrailRepository.find({
      where: { editedBy: userId },
      relations: ['employee'],
      order: { actionDate: 'DESC' },
    });
  }

  async remove(employeeId: number): Promise<void> {
      const result = await this.auditTrailRepository.delete({ employeeId });
      
      if (result.affected === 0) {
        throw new NotFoundException(`User with ID ${employeeId} not found`);
      }
    }

    /**
 * Log employee creation with query runner for transaction support
 */
async logEmployeeCreationWithQueryRunner(
  employee: Employee,
  userId: number,
  queryRunner: any,
): Promise<void> {
  const auditEntry = queryRunner.manager.create(AuditTrail, {
    employeeId: employee.id,
    userId: userId,
    action: AuditTrailAction.CREATED,
    entityType: 'Employee',
    entityId: employee.id,
    changes: JSON.stringify({
      new: {
        employeeId: employee.employeeId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        department: employee.department,
        designation: employee.designation,
        status: employee.status,
      },
    }),
    timestamp: new Date(),
  });

  await queryRunner.manager.save(AuditTrail, auditEntry);
}
}