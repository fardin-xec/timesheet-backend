// src/services/leave.service.ts
import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Leave, LeaveType, LeaveStatus } from '../entities/leave.entity';
import { LeaveRule } from '../entities/leave-rule.entity';
import { LeaveBalances } from '../entities/leave-balance.entity';
import { Employee, EmployeeStatus } from '../entities/employees.entity';
import { ApplyLeaveDto, UpdateLeaveDto, ApproveRejectLeaveDto, LeaveFilterDto } from './dto/create-leave.dto';
import { EmployeeLeaveRule } from 'src/entities/employee-leave-rule.entity';
import { DocumentsService } from 'src/documents/documents.service';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(Leave)
    private leaveRepository: Repository<Leave>,
    @InjectRepository(LeaveRule)
    private leaveRuleRepository: Repository<LeaveRule>,
    @InjectRepository(LeaveBalances)
    private leaveBalanceRepository: Repository<LeaveBalances>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
      @InjectRepository(EmployeeLeaveRule)
    private employeeLeaveRuleRepository: Repository<EmployeeLeaveRule>,
        private documnetService:DocumentsService,
    
  ) {}

  async applyLeave(employeeId: number, dto: ApplyLeaveDto): Promise<Leave> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
      relations: ['organization'],
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Validate employee is not in notice period
    if (employee.status === EmployeeStatus.PENDING_INACTIVE) {
      throw new BadRequestException('Leave applications are not allowed during notice period');
    }

    // Validate dates
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate > endDate) {
      throw new BadRequestException('Start date cannot be after end date');
    }

    if (startDate < today) {
      throw new BadRequestException('Cannot apply for past dates');
    }

    // Validate leave rules
    const leaveRule = await this.leaveRuleRepository.findOne({
      where: {
        organization: { orgId: employee.orgId },
        leaveType: dto.leaveType as any,
        isActive: true,
      },
    });

    if (!leaveRule) {
      throw new BadRequestException(`Leave type ${dto.leaveType} is not configured`);
    }

    // Check gender eligibility for maternity leave
    if (dto.leaveType === LeaveType.MATERNITY && employee.gender !== 'female') {
      throw new BadRequestException('Maternity leave is only applicable for female employees');
    }

    // Check minimum tenure
    const tenureMonths = this.calculateTenureMonths(employee.joiningDate);
    if (tenureMonths < leaveRule.minTenureMonths) {
      throw new BadRequestException(
        `Minimum tenure of ${leaveRule.minTenureMonths} months required for ${dto.leaveType} leave`
      );
    }

    // Validate CL/SL within current year
    if (dto.leaveType === LeaveType.CASUAL || dto.leaveType === LeaveType.SICK) {
      const currentYear = new Date().getFullYear();
      const endYear = endDate.getFullYear();
      
      if (endYear > currentYear) {
        throw new BadRequestException(
          `${dto.leaveType.toUpperCase()} leave cannot be applied beyond December 31st of current year`
        );
      }
    }

    // Validate emergency leave requires document
    if (dto.leaveType === LeaveType.EMERGENCY && !dto.documentId) {
      throw new BadRequestException('Please upload the supporting document to apply for Emergency Leave');
    }

    // Calculate applied days with sandwich leave policy
    const appliedDays = await this.calculateLeaveDays(
      startDate,
      endDate,
      dto.isHalfDay || false,
      employee.orgId
    );

    // Check leave balance
    const currentYear = new Date().getFullYear();
    let leaveBalance = await this.leaveBalanceRepository.findOne({
      where: {
        employee: { id: employeeId },
        leaveType: dto.leaveType as any,
        year: currentYear,
      },
    });

    // Initialize balance if not exists
    if (!leaveBalance) {
      leaveBalance = await this.initializeLeaveBalance(
        employeeId,
        dto.leaveType,
        currentYear,
        leaveRule.maxAllowed
      );
    }

    const availableBalance = leaveBalance.totalAllowed - leaveBalance.used;
    
    // For Loss of Pay, allow application even if balance is insufficient
    if (dto.leaveType !== LeaveType.LOSSOFPAY && appliedDays > availableBalance) {
      throw new BadRequestException(
        `Insufficient leave balance. Available: ${availableBalance} days, Requested: ${appliedDays} days`
      );
    }

    // Create leave application
    const leave = this.leaveRepository.create({
      employeeId,
      leaveType: dto.leaveType,
      startDate,
      endDate,
      appliedDays,
      reason: dto.reason,
      isHalfDay: dto.isHalfDay || false,
      halfDayType: dto.halfDayType,
      documentId: dto.documentId,
      status: LeaveStatus.PENDING,
    });

    const savedLeave = await this.leaveRepository.save(leave);

    // Log in audit trail
    await this.createAuditLog(employeeId, 'LEAVE_APPLIED', savedLeave.id);

    return this.leaveRepository.findOne({
      where: { id: savedLeave.id },
      relations: ['employee', 'approver'],
    });
  }

  async updateLeave(
    leaveId: number,
    employeeId: number,
    dto: UpdateLeaveDto
  ): Promise<Leave> {
    const leave = await this.leaveRepository.findOne({
      where: { id: leaveId },
      relations: ['employee'],
    });

    if (!leave) {
      throw new NotFoundException('Leave application not found');
    }

    if (leave.employeeId !== employeeId) {
      throw new ForbiddenException('You can only update your own leave applications');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only pending leave applications can be updated');
    }

    // Update fields
    if (dto.startDate) leave.startDate = new Date(dto.startDate);
    if (dto.endDate) leave.endDate = new Date(dto.endDate);
    if (dto.reason) leave.reason = dto.reason;
    if (dto.isHalfDay !== undefined) leave.isHalfDay = dto.isHalfDay;
    if (dto.halfDayType) leave.halfDayType = dto.halfDayType;
    if (dto.documentId) leave.documentId = dto.documentId;

    // Recalculate days if dates changed
    if (dto.startDate || dto.endDate) {
      leave.appliedDays = await this.calculateLeaveDays(
        leave.startDate,
        leave.endDate,
        leave.isHalfDay,
        leave.employee.orgId
      );
    }

    const updatedLeave = await this.leaveRepository.save(leave);
    await this.createAuditLog(employeeId, 'LEAVE_UPDATED', leaveId);

    return this.leaveRepository.findOne({
      where: { id: updatedLeave.id },
      relations: ['employee', 'approver'],
    });
  }

  async deleteLeave(leaveId: number, employeeId: number): Promise<void> {
    const leave = await this.leaveRepository.findOne({
      where: { id: leaveId },
    });

    if (!leave) {
      throw new NotFoundException('Leave application not found');
    }

    if (leave.employeeId !== employeeId) {
      throw new ForbiddenException('You can only delete your own leave applications');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only pending leave applications can be deleted');
    }

    if(leave.documentId){
      await this.documnetService.deleteDocument(leave.documentId);
    }

    await this.leaveRepository.remove(leave);
    await this.createAuditLog(employeeId, 'LEAVE_DELETED', leaveId);
  }

  async approveRejectLeave(
    leaveId: number,
    approverId: number,
    dto: ApproveRejectLeaveDto
  ): Promise<Leave> {
    const leave = await this.leaveRepository.findOne({
      where: { id: leaveId },
      relations: ['employee'],
    });

        console.log(leave);


    if (!leave) {
      throw new NotFoundException('Leave application not found');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Leave has already been processed');
    }

    leave.status = dto.status;
    leave.approvedBy = approverId;

    // Update leave balance if approved
    if (dto.status === LeaveStatus.APPROVED) {
      const currentYear = new Date().getFullYear();
      const leaveBalance = await this.leaveBalanceRepository.findOne({
        where: {
          employee: { id: leave.employeeId },
          leaveType: leave.leaveType as any,
          year: currentYear,
        },
      });



      if (leaveBalance) {
        leaveBalance.used = parseFloat(leaveBalance.used.toString()) + parseFloat(leave.appliedDays.toString());
        if(leave.leaveType===LeaveType.ANNUAL){
          leaveBalance.carryForwarded = parseFloat(leaveBalance.carryForwarded.toString()) - parseFloat(leave.appliedDays.toString());

        }

        console.log(leaveBalance);

        await this.leaveBalanceRepository.save(leaveBalance);
      }
    }

    const updatedLeave = await this.leaveRepository.save(leave);
    await this.createAuditLog(
      approverId,
      dto.status === LeaveStatus.APPROVED ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      leaveId
    );

    return this.leaveRepository.findOne({
      where: { id: updatedLeave.id },
      relations: ['employee', 'approver'],
    });
  }

  async getEmployeeLeaves(employeeId: number, filter?: LeaveFilterDto): Promise<Leave[]> {
    const where: any = { employeeId };

    if (filter?.leaveType) where.leaveType = filter.leaveType;
    if (filter?.status) where.status = filter.status;
    if (filter?.startDate && filter?.endDate) {
      where.startDate = Between(new Date(filter.startDate), new Date(filter.endDate));
    }

    return this.leaveRepository.find({
      where,
      relations: ['employee'],
      order: { createdAt: 'DESC' },
    });
  }

 async getEmployeeLeavesRules(employeeId: number): Promise<EmployeeLeaveRule[]> {
    return this.employeeLeaveRuleRepository.find({
      where: { employee: { id: employeeId } },
      relations: ['rule'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAllLeaves(filter?: LeaveFilterDto): Promise<Leave[]> {
    const where: any = {};

    if (filter?.employeeId) where.employeeId = filter.employeeId;
    if (filter?.leaveType) where.leaveType = filter.leaveType;
    if (filter?.status) where.status = filter.status;
    if (filter?.startDate && filter?.endDate) {
      where.startDate = Between(new Date(filter.startDate), new Date(filter.endDate));
    }

    return this.leaveRepository.find({
      where,
      relations: ['employee', 'approver'],
      order: { createdAt: 'DESC' },
    });
  }

  async getLeaveById(leaveId: number): Promise<Leave> {
    const leave = await this.leaveRepository.findOne({
      where: { id: leaveId },
      relations: ['employee', 'approver'],
    });

    if (!leave) {
      throw new NotFoundException('Leave application not found');
    }

    return leave;
  }

  private async calculateLeaveDays(
    startDate: Date,
    endDate: Date,
    isHalfDay: boolean,
    orgId: number
  ): Promise<number> {
    if (isHalfDay) return 0.5;

    let totalDays = 0;
    const currentDate = new Date(startDate);

    // Apply sandwich leave policy - count all days including weekends and holidays
    while (currentDate <= endDate) {
      totalDays++;
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalDays;
  }

  private calculateTenureMonths(joiningDate: Date | string): number {
  const today = new Date();
  
  // Convert to Date object if it's a string
  const joinDate = typeof joiningDate === 'string' 
    ? new Date(joiningDate) 
    : joiningDate;
  
  // Validate the date
  if (isNaN(joinDate.getTime())) {
    console.error('Invalid joining date:', joiningDate);
    return 0;
  }
  
  const months =
    (today.getFullYear() - joinDate.getFullYear()) * 12 +
    (today.getMonth() - joinDate.getMonth());
  
  return months;
}

  async initializeLeaveBalance(
    employeeId: number,
    leaveType: LeaveType,
    year: number,
    totalAllowed: number
  ): Promise<LeaveBalances> {
    const balance = this.leaveBalanceRepository.create({
      employee: { id: employeeId },
      leaveType: leaveType as any,
      year,
      totalAllowed,
      used: 0,
      carryForwarded: leaveType===LeaveType.ANNUAL? 10: 0,
    });

    return this.leaveBalanceRepository.save(balance);
  }

 async deleteLeaveBalance(
  employeeId: number,
  year: number,
): Promise<void> {
  await this.leaveBalanceRepository.delete({
    employee: { id: employeeId },
    year,
  });
}
  private async createAuditLog(userId: number, action: string, leaveId: number): Promise<void> {
    // Implement audit logging here
    console.log(`Audit: User ${userId} performed ${action} on leave ${leaveId}`);
  }

async getLeaveBalancesByEmployeeId(employeeId: number): Promise<LeaveBalances[]> {
  const employee = await this.employeeRepository.findOne({
    where: { id: employeeId },
  });

  if (!employee) {
    throw new NotFoundException('Employee not found');
  }
  const currentYear = new Date().getFullYear();
  const leaveBalances = await this.leaveBalanceRepository.find({
    where: { 
      employee: { id: employeeId }, 
      year: currentYear,
    },
    relations: ['employee'],
    order: {
      year: 'DESC',
      leaveType: 'ASC'
    }
  });

  if (!leaveBalances || leaveBalances.length === 0) {
    throw new NotFoundException('Leave balances not found for this employee');
  }

  return leaveBalances;
}

 async deleteLeavesByEmployeeId(employeeId: number): Promise<void> {
  // Find if any leave exists that is NOT pending or does not belong to employee
  const Leaves = await this.leaveRepository.find({
    where: [
      { employeeId}
    ],
  });

  if(Leaves.length!==0){
    // Bulk delete all pending leaves of this employee
      await this.leaveRepository.delete({ employeeId });

      // Optionally, log audit for deletion in bulk (or per leave if needed)
      await this.createAuditLog(employeeId, 'LEAVE_DELETED', null); // leaveId null for bulk delete
      }
  
}

// Add this method to your LeaveService class

async getSubordinateLeaves(
  managerId: number,
  filter?: LeaveFilterDto
): Promise<Leave[]> {
  // First, verify the manager exists
  const manager = await this.employeeRepository.findOne({
    where: { id: managerId },
  });

  if (!manager) {
    throw new NotFoundException('Manager not found');
  }

  // Find all employees who report to this manager
  const subordinates = await this.employeeRepository.find({
    where: { reportTo: managerId },
  });

  if (subordinates.length === 0) {
    return []; // Manager has no subordinates
  }

  // Get all subordinate IDs
  const subordinateIds = subordinates.map(sub => sub.id);

  // Build where clause
  const where: any = {
    employeeId: In(subordinateIds),
  };

  if (filter?.leaveType) {
    where.leaveType = filter.leaveType;
  }

  if (filter?.status) {
    where.status = filter.status;
  }

  if (filter?.startDate && filter?.endDate) {
    where.startDate = Between(
      new Date(filter.startDate),
      new Date(filter.endDate)
    );
  }

  // Fetch leaves of all subordinates
  const leaves = await this.leaveRepository.find({
    where,
    relations: ['employee', 'approver'],
    order: { createdAt: 'DESC' },
  });

  return leaves;
}

// Alternative: Get leaves with pagination and additional info
async getSubordinateLeavesWithDetails(
  managerId: number,
  filter?: LeaveFilterDto,
  page: number = 1,
  limit: number = 10
): Promise<{
  leaves: Leave[];
  total: number;
  page: number;
  totalPages: number;
  subordinateCount: number;
}> {
  const manager = await this.employeeRepository.findOne({
    where: { id: managerId },
  });

  if (!manager) {
    throw new NotFoundException('Manager not found');
  }

  // Find all employees who report to this manager
  const subordinates = await this.employeeRepository.find({
    where: { reportTo: managerId },
  });

  if (subordinates.length === 0) {
    return {
      leaves: [],
      total: 0,
      page,
      totalPages: 0,
      subordinateCount: 0,
    };
  }

  const subordinateIds = subordinates.map(sub => sub.id);

  const where: any = {
    employeeId: In(subordinateIds),
  };

  if (filter?.leaveType) where.leaveType = filter.leaveType;
  if (filter?.status) where.status = filter.status;
  if (filter?.startDate && filter?.endDate) {
    where.startDate = Between(
      new Date(filter.startDate),
      new Date(filter.endDate)
    );
  }

  const [leaves, total] = await this.leaveRepository.findAndCount({
    where,
    relations: ['employee', 'approver'],
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    leaves,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    subordinateCount: subordinateIds.length,
  };
}

async getLeaveTypesWithBalances(employeeId: number): Promise<{ leaveType: LeaveType; balance: LeaveBalances | null }[]> {
  const employee = await this.employeeRepository.findOne({ where: { id: employeeId } });
  if (!employee) {
    throw new NotFoundException('Employee not found');
  }

  const currentYear = new Date().getFullYear();

  // Assume LeaveType is an enum or you have a repository to fetch active leave types
  // Here, I use Object.values(LeaveType) for enum
  const leaveTypes = Object.values(LeaveType).filter(lt => typeof lt === 'string');

  // Fetch leave balances for the employee for the current year once
  const balances = await this.leaveBalanceRepository.find({
    where: { employee: { id: employeeId }, year: currentYear },
  });

  // Map leave types to their balances (or null if none)
  return leaveTypes.map((lt) => {
    const balance = balances.find(bal => bal.leaveType === lt) || null;
    return { leaveType: lt, balance };
  });
}

// Add these methods to your LeaveService class

async assignLeaveRuleToEmployee(
  employeeId: number,
  ruleId: number,
  orgId: number
): Promise<EmployeeLeaveRule> {
  // Verify employee exists and belongs to the organization
  const employee = await this.employeeRepository.findOne({
    where: { id: employeeId, orgId },
  });

  if (!employee) {
    throw new NotFoundException('Employee not found in your organization');
  }

  // Verify leave rule exists and belongs to the organization
  const leaveRule = await this.leaveRuleRepository.findOne({
    where: { id: ruleId, organization: { orgId } },
  });

  if (!leaveRule) {
    throw new NotFoundException('Leave rule not found in your organization');
  }

  // Check if the rule is already assigned
  const existingAssignment = await this.employeeLeaveRuleRepository.findOne({
    where: {
      employee: { id: employeeId },
      rule: { id: ruleId },
    },
  });

  if (existingAssignment) {
    throw new BadRequestException('Leave rule is already assigned to this employee');
  }

  // Create the assignment
  const employeeLeaveRule = this.employeeLeaveRuleRepository.create({
    employee: { id: employeeId },
    rule: { id: ruleId },
  });

  const savedAssignment = await this.employeeLeaveRuleRepository.save(employeeLeaveRule);

  // Initialize leave balance for the current year if not exists
  const currentYear = new Date().getFullYear();
  const existingBalance = await this.leaveBalanceRepository.findOne({
    where: {
      employee: { id: employeeId },
      leaveType: leaveRule.leaveType,
      year: currentYear,
    },
  });

  if (!existingBalance) {
    await this.initializeLeaveBalance(
      employeeId,
      leaveRule.leaveType,
      currentYear,
      leaveRule.maxAllowed
    );
  }

  return this.employeeLeaveRuleRepository.findOne({
    where: { id: savedAssignment.id },
    relations: ['employee', 'rule'],
  });
}

async unassignLeaveRuleFromEmployee(
  employeeId: number,
  ruleId: number,
  orgId: number
): Promise<void> {
  // Verify employee exists and belongs to the organization
  const employee = await this.employeeRepository.findOne({
    where: { id: employeeId, orgId },
  });

  if (!employee) {
    throw new NotFoundException('Employee not found in your organization');
  }

  // Verify leave rule exists and belongs to the organization
  const leaveRule = await this.leaveRuleRepository.findOne({
    where: { id: ruleId, organization: { orgId } },
  });

  if (!leaveRule) {
    throw new NotFoundException('Leave rule not found in your organization');
  }

  // Find the assignment
  const assignment = await this.employeeLeaveRuleRepository.findOne({
    where: {
      employee: { id: employeeId },
      rule: { id: ruleId },
    },
  });

  if (!assignment) {
    throw new NotFoundException('Leave rule assignment not found for this employee');
  }

  // Check if employee has any pending or approved leaves for this leave type
  const activeLeaves = await this.leaveRepository.count({
    where: {
      employeeId,
      leaveType: leaveRule.leaveType,
      status: In([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
    },
  });

  if (activeLeaves > 0) {
    throw new BadRequestException(
      `Cannot unassign leave rule. Employee has ${activeLeaves} pending or approved leave(s) for ${leaveRule.leaveType} type. Please process or cancel these leaves first.`
    );
  }

  // Additionally check if employee has used any balance for this leave type in current year
  const currentYear = new Date().getFullYear();
  const leaveBalance = await this.leaveBalanceRepository.findOne({
    where: {
      employee: { id: employeeId },
      leaveType: leaveRule.leaveType,
      year: currentYear,
    },
  });

  if (leaveBalance && leaveBalance.used > 0) {
    throw new BadRequestException(
      `Cannot unassign leave rule. Employee has already used ${leaveBalance.used} day(s) of ${leaveRule.leaveType} leave in ${currentYear}. Leave rules can only be unassigned if no leaves have been utilized.`
    );
  }

  // Remove the assignment
  await this.employeeLeaveRuleRepository.remove(assignment);

  // Optionally, you may want to delete the leave balance for this type
  // Uncomment if you want to remove the balance when unassigning
  // await this.leaveBalanceRepository.delete({
  //   employee: { id: employeeId },
  //   leaveType: leaveRule.leaveType,
  //   year: currentYear,
  // });
}


}