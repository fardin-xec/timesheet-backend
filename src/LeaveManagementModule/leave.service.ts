// src/services/leave.service.ts
import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Leave, LeaveType, LeaveStatus } from '../entities/leave.entity';
import { LeaveRule } from '../entities/leave-rule.entity';
import { LeaveBalances } from '../entities/leave-balance.entity';
import { Employee, EmployeeStatus } from '../entities/employees.entity';
import { ApplyLeaveDto, UpdateLeaveDto, ApproveRejectLeaveDto, LeaveFilterDto } from './dto/create-leave.dto';
import { EmployeeLeaveRule } from 'src/entities/employee-leave-rule.entity';
import { DocumentsService } from 'src/documents/documents.service';
import * as nodemailer from 'nodemailer';
import { EmailService } from 'src/email/smtpEmail.service';
import { existsSync, readFileSync } from 'fs';
import { basename, extname } from 'path';
import { LeaveValidationService } from './leave-validation.service';

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
    private documnetService: DocumentsService,
    private emailService: EmailService,
    private leaveValidationService: LeaveValidationService
  ) {}

async applyLeave(employeeId: number, dto: ApplyLeaveDto): Promise<Leave> {
  const employee = await this.employeeRepository.findOne({
    where: { id: employeeId },
    relations: ['organization', 'manager'],
  });

  if (!employee) {
    throw new NotFoundException('Employee not found');
  }

  if (employee.status === EmployeeStatus.PENDING_INACTIVE) {
    throw new BadRequestException('Leave applications are not allowed during notice period');
  }

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

  const validateDate = await this.leaveValidationService.validateLeaveDates(startDate,endDate,employee.orgId);
  console.log(validateDate);
  
  if(!validateDate.isValid){
    throw new BadRequestException('Leave dates include weekend days (Friday/Saturday) or Holidays');

  }

  // Check for overlapping leaves
  const overlappingLeave = await this.leaveRepository.findOne({
    where: {
      employeeId,
      status: In([LeaveStatus.PENDING, LeaveStatus.APPROVED]), // Consider statuses that block new leave
      startDate: LessThanOrEqual(endDate),
      endDate: MoreThanOrEqual(startDate),
    },
  });

  if (overlappingLeave) {
    throw new BadRequestException(
      `Leave already applied from ${startDate.toDateString()} to ${endDate.toDateString()}`
    );
  }

  // Continue existing checks...
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

  if (dto.leaveType === LeaveType.MATERNITY && employee.gender !== 'female') {
    throw new BadRequestException('Maternity leave is only applicable for female employees');
  }

  // const tenureMonths = this.calculateTenureMonths(employee.joiningDate);

  // if (tenureMonths < leaveRule.minTenureMonths) {  // fixed comparison operator
  //   throw new BadRequestException(
  //     `Minimum tenure of ${leaveRule.minTenureMonths} months required for ${dto.leaveType} leave`
  //   );
  // }

  if (
    dto.leaveType === LeaveType.CASUAL ||
    dto.leaveType === LeaveType.SICK ||
    dto.leaveType === LeaveType.ANNUAL
  ) {
    const currentYear = new Date().getFullYear();
    const endYear = endDate.getFullYear();

    if (endYear > currentYear) {
      throw new BadRequestException(
        `${dto.leaveType.toUpperCase()} leave cannot be applied beyond December 31st of current year`
      );
    }
  }

  if (dto.leaveType === LeaveType.EMERGENCY && !dto.documentId) {
    throw new BadRequestException('Please upload the supporting document to apply for Emergency Leave');
  }

  const appliedDays = dto.appliedDays;

  const currentYear = new Date().getFullYear();
  let leaveBalance = await this.leaveBalanceRepository.findOne({
    where: {
      employee: { id: employeeId },
      leaveType: dto.leaveType as any,
      year: currentYear,
    },
  });

  if (!leaveBalance) {
    leaveBalance = await this.initializeLeaveBalance(
      employeeId,
      dto.leaveType,
      currentYear,
      leaveRule.maxAllowed
    );
  } 

  const availableBalance = leaveBalance.totalAllowed - leaveBalance.used;

  if (dto.leaveType !== LeaveType.LOSSOFPAY && appliedDays > availableBalance) {
    throw new BadRequestException(
      `Insufficient leave balance. Available: ${availableBalance} days, Requested: ${appliedDays} days`
    );
  }

 
  leaveBalance.used =(parseFloat(leaveBalance.used.toString()) + parseFloat(appliedDays.toString()));
  await this.leaveBalanceRepository.save(leaveBalance);
  

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

  const fullLeave = await this.leaveRepository.findOne({
    where: { id: savedLeave.id },
    relations: ['employee', 'employee.manager', 'employee.organization'],
  });

  await this.sendLeaveApplicationEmail(fullLeave, employee);
  await this.createAuditLog(employeeId, 'LEAVE_APPLIED', savedLeave.id);

  return fullLeave;
}


  async updateLeave(leaveId: number, employeeId: number, dto: UpdateLeaveDto): Promise<Leave> {
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

    if (dto.startDate) leave.startDate = new Date(dto.startDate);
    if (dto.endDate) leave.endDate = new Date(dto.endDate);
    if (dto.reason) leave.reason = dto.reason;
    if (dto.isHalfDay !== undefined) leave.isHalfDay = dto.isHalfDay;
    if (dto.halfDayType) leave.halfDayType = dto.halfDayType;
    if (dto.documentId) leave.documentId = dto.documentId;
    if (dto.leaveType) leave.leaveType = dto.leaveType;

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

    if (leave.status === LeaveStatus.PENDING) {
      const currentYear = new Date().getFullYear();
      const leaveBalance = await this.leaveBalanceRepository.findOne({
        where: {
          employee: { id: leave.employeeId },
          leaveType: leave.leaveType as any,
          year: currentYear,
        },
      });
      if (leaveBalance) {
        leaveBalance.used = parseFloat(leaveBalance.used.toString()) - parseFloat(leave.appliedDays.toString());
        await this.leaveBalanceRepository.save(leaveBalance);
      }
      
    }

    if (leave.documentId) {
      await this.documnetService.deleteDocument(leave.documentId);
    }

    await this.leaveRepository.remove(leave);
    await this.createAuditLog(employeeId, 'LEAVE_DELETED', leaveId);
  }

  async approveRejectLeave(leaveId: number, approverId: number, dto: ApproveRejectLeaveDto): Promise<Leave> {
    const leave = await this.leaveRepository.findOne({
      where: { id: leaveId },
      relations: ['employee', 'employee.manager', 'employee.organization'],
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
    leave.rejectionReason = dto.status === LeaveStatus.REJECTED ? dto.remarks : null;

    if (dto.status === LeaveStatus.REJECTED) {
      const currentYear = new Date().getFullYear();
      const leaveBalance = await this.leaveBalanceRepository.findOne({
        where: {
          employee: { id: leave.employeeId },
          leaveType: leave.leaveType as any,
          year: currentYear,
        },
      });
      if (leaveBalance) {
        leaveBalance.used = parseFloat(leaveBalance.used.toString()) - parseFloat(leave.appliedDays.toString());
        await this.leaveBalanceRepository.save(leaveBalance);
      }
      
    }

    const updatedLeave = await this.leaveRepository.save(leave);

    const approver = await this.employeeRepository.findOne({
      where: { id: approverId },
    });

    await this.sendLeaveDecisionEmail(updatedLeave, approver, dto.status, dto.remarks);

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
    const Leaves = await this.leaveRepository.find({
      where: [{ employeeId }],
    });

    if (Leaves.length !== 0) {
      await this.leaveRepository.delete({ employeeId });
      await this.createAuditLog(employeeId, 'LEAVE_DELETED', null);
    }
  }

  async getSubordinateLeaves(managerId: number, filter?: LeaveFilterDto): Promise<Leave[]> {
    const manager = await this.employeeRepository.findOne({
      where: { id: managerId },
    });

    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    const subordinates = await this.employeeRepository.find({
      where: { reportTo: managerId },
    });

    if (subordinates.length === 0) {
      return [];
    }

    const subordinateIds = subordinates.map(sub => sub.id);
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
      where.startDate = Between(new Date(filter.startDate), new Date(filter.endDate));
    }

    const leaves = await this.leaveRepository.find({
      where,
      relations: ['employee', 'approver'],
      order: { createdAt: 'DESC' },
    });

    return leaves;
  }

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
      where.startDate = Between(new Date(filter.startDate), new Date(filter.endDate));
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
    const leaveTypes = Object.values(LeaveType).filter(lt => typeof lt === 'string');
    const balances = await this.leaveBalanceRepository.find({
      where: { employee: { id: employeeId }, year: currentYear },
    });

    return leaveTypes.map((lt) => {
      const balance = balances.find(bal => bal.leaveType === lt) || null;
      return { leaveType: lt, balance };
    });
  }

  async assignLeaveRuleToEmployee(employeeId: number, ruleId: number, orgId: number): Promise<EmployeeLeaveRule> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId, orgId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found in your organization');
    }

    const leaveRule = await this.leaveRuleRepository.findOne({
      where: { id: ruleId, organization: { orgId } },
    });

    if (!leaveRule) {
      throw new NotFoundException('Leave rule not found in your organization');
    }

    const existingAssignment = await this.employeeLeaveRuleRepository.findOne({
      where: {
        employee: { id: employeeId },
        rule: { id: ruleId },
      },
    });

    if (existingAssignment) {
      throw new BadRequestException('Leave rule is already assigned to this employee');
    }

    const employeeLeaveRule = this.employeeLeaveRuleRepository.create({
      employee: { id: employeeId },
      rule: { id: ruleId },
    });

    const savedAssignment = await this.employeeLeaveRuleRepository.save(employeeLeaveRule);

    const currentYear = new Date().getFullYear();
    const existingBalance = await this.leaveBalanceRepository.findOne({
      where: {
        employee: { id: employeeId },
        leaveType: leaveRule.leaveType,
        year: currentYear,
      },
    });

    if (!existingBalance) {
      await this.initializeLeaveBalance(employeeId, leaveRule.leaveType, currentYear, leaveRule.maxAllowed);
    }

    return this.employeeLeaveRuleRepository.findOne({
      where: { id: savedAssignment.id },
      relations: ['employee', 'rule'],
    });
  }

  async unassignLeaveRuleFromEmployee(employeeId: number, ruleId: number, orgId: number): Promise<void> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId, orgId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found in your organization');
    }

    const leaveRule = await this.leaveRuleRepository.findOne({
      where: { id: ruleId, organization: { orgId } },
    });

    if (!leaveRule) {
      throw new NotFoundException('Leave rule not found in your organization');
    }

    const assignment = await this.employeeLeaveRuleRepository.findOne({
      where: {
        employee: { id: employeeId },
        rule: { id: ruleId },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Leave rule assignment not found for this employee');
    }

    const activeLeaves = await this.leaveRepository.count({
      where: {
        employeeId,
        leaveType: leaveRule.leaveType,
        status: In([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
      },
    });

    if (activeLeaves > 0) {
      throw new BadRequestException(
        `Cannot unassign leave rule. Employee has ${activeLeaves} pending or approved leave(s) for ${leaveRule.leaveType} type.`
      );
    }

    const currentYear = new Date().getFullYear();
    const leaveBalance = await this.leaveBalanceRepository.findOne({
      where: {
        employee: { id: employeeId },
        leaveType: leaveRule.leaveType,
        year: currentYear,
      },
    });

    if(leaveBalance){
          await this.leaveBalanceRepository.remove(leaveBalance);

    }

    if (leaveBalance && leaveBalance.used > 0) {
      throw new BadRequestException(
        `Cannot unassign leave rule. Employee has already used ${leaveBalance.used} day(s) of ${leaveRule.leaveType} leave.`
      );
    }

    await this.employeeLeaveRuleRepository.remove(assignment);
  }

  // EMAIL NOTIFICATION METHODS

  private async sendLeaveApplicationEmail(leave: Leave, employee: Employee): Promise<void> {
    try {
      const recipientEmails = await this.getLeaveNotificationRecipients(employee);
      
      if (!recipientEmails.managerEmail) {
        console.warn('No manager email found for leave notification');
        return;
      }

      const emailData = {
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeId: employee.employeeId,
        leaveType: this.formatLeaveType(leave.leaveType),
        startDate: this.formatDate(leave.startDate),
        endDate: this.formatDate(leave.endDate),
        appliedDays: leave.appliedDays,
        reason: leave.reason || 'N/A',
        isHalfDay: leave.isHalfDay ? 'Yes' : 'No',
        halfDayType: leave.halfDayType ? this.formatHalfDayType(leave.halfDayType) : 'N/A',
        applicationDate: this.formatDate(leave.createdAt),
        organizationName: employee.organization?.orgName || 'Organization',
      };

      const htmlTemplate = this.getLeaveApplicationEmailTemplate(emailData);
      const textTemplate = this.getLeaveApplicationTextTemplate(emailData);

      let attachments: nodemailer.Attachment[] = [];
      if (leave.documentId) {
        try {
          const document = await this.documnetService.getDocument(leave.documentId);
          if (document && document.filePath) {
            // Check if file exists
            if (existsSync(document.filePath)) {
              // Read file as base64
              const fileContent = readFileSync(document.filePath);
              const base64Content = fileContent.toString('base64');
              
              // Get file extension and mime type
              const fileExtension = extname(document.originalName || document.filePath).toLowerCase();
              const mimeType = this.getMimeType(fileExtension);
              
              attachments.push({
                filename: document.originalName || basename(document.filePath),
                content: base64Content,
                encoding: 'base64',
                contentType: mimeType,
              });
            } else {
              console.warn(`Document file not found at path: ${document.filePath}`);
            }
          }
        } catch (error) {
          console.error('Error fetching leave document:', error);
        }
      }

      const ccEmails = [
        ...recipientEmails.peerEmails,
        ...recipientEmails.hrEmails,
        ...recipientEmails.pmEmails
      ].filter((email, index, self) => self.indexOf(email) === index);

      await this.emailService.sendMail(
        recipientEmails.managerEmail,
        `Leave Application - ${emailData.employeeName} (${emailData.leaveType})`,
        textTemplate,
        htmlTemplate,
        {
          cc: ccEmails.length > 0 ? ccEmails : undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
        }
      );

      console.log(`Leave application email sent successfully for leave ID: ${leave.id}`);
    } catch (error) {
      console.error('Error sending leave application email:', error);
    }
  }

  private async sendLeaveDecisionEmail(
    leave: Leave,
    approver: Employee,
    status: LeaveStatus,
    rejectionReason?: string
  ): Promise<void> {
    try {
      const employee = leave.employee;
      
      if (!employee?.email) {
        console.warn('Employee email not found');
        return;
      }

      const isApproved = status === LeaveStatus.APPROVED;
      const statusText = isApproved ? 'Approved' : 'Rejected';
      const statusColor = isApproved ? '#10B981' : '#EF4444';

      const emailData = {
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeId: employee.employeeId,
        leaveType: this.formatLeaveType(leave.leaveType),
        startDate: this.formatDate(leave.startDate),
        endDate: this.formatDate(leave.endDate),
        appliedDays: leave.appliedDays,
        reason: leave.reason || 'N/A',
        isHalfDay: leave.isHalfDay ? 'Yes' : 'No',
        halfDayType: leave.halfDayType ? this.formatHalfDayType(leave.halfDayType) : 'N/A',
        approverName: `${approver.firstName} ${approver.lastName}`,
        statusText,
        statusColor,
        rejectionReason: rejectionReason || 'N/A',
        decisionDate: this.formatDate(new Date()),
      };

      const htmlTemplate = this.getLeaveDecisionEmailTemplate(emailData, isApproved);
      const textTemplate = this.getLeaveDecisionTextTemplate(emailData, isApproved);

      let attachments: nodemailer.Attachment[] = [];
      if (leave.documentId) {
        try {
          const document = await this.documnetService.getDocument(leave.documentId);
          if (document && document.filePath) {
            // Check if file exists
            if (existsSync(document.filePath)) {
              // Read file as base64
              const fileContent = readFileSync(document.filePath);
              const base64Content = fileContent.toString('base64');
              
              // Get file extension and mime type
              const fileExtension = extname(document.originalName || document.filePath).toLowerCase();
              const mimeType = this.getMimeType(fileExtension);
              
              attachments.push({
                filename: document.originalName || basename(document.filePath),
                content: base64Content,
                encoding: 'base64',
                contentType: mimeType,
              });
            } else {
              console.warn(`Document file not found at path: ${document.filePath}`);
            }
          }
        } catch (error) {
          console.error('Error fetching leave document:', error);
        }
      }

      await this.emailService.sendMail(
        employee.email,
        `Leave ${statusText} - ${emailData.leaveType}`,
        textTemplate,
        htmlTemplate,
        {
          attachments: attachments.length > 0 ? attachments : undefined,
        }
      );

      console.log(`Leave decision email sent successfully for leave ID: ${leave.id}`);
    } catch (error) {
      console.error('Error sending leave decision email:', error);
    }
  }

  private async getLeaveNotificationRecipients(employee: Employee): Promise<{
    managerEmail: string;
    peerEmails: string[];
    hrEmails: string[];
    pmEmails: string[];
  }> {
    const result = {
      managerEmail: '',
      peerEmails: [] as string[],
      hrEmails: [] as string[],
      pmEmails: [] as string[],
    };

    if (employee.manager?.email) {
      result.managerEmail = employee.manager.email;
    } else if (employee.reportTo) {
      const manager = await this.employeeRepository.findOne({
        where: { id: employee.reportTo },
      });
      if (manager?.email) {
        result.managerEmail = manager.email;
      }
    }

    if (employee.reportTo) {
      const peers = await this.employeeRepository.find({
        where: {
          reportTo: employee.reportTo,
          status: EmployeeStatus.ACTIVE,
        },
      });
      
      result.peerEmails = peers
        .filter(peer => peer.id !== employee.id && peer.email)
        .map(peer => peer.email);
    }

    const hrEmployees = await this.employeeRepository.find({
      where: [
        { jobTitle: 'HR Manager', orgId: employee.orgId, status: EmployeeStatus.ACTIVE },
        { jobTitle: 'HR Executive', orgId: employee.orgId, status: EmployeeStatus.ACTIVE },
      ],
    });
    
    result.hrEmails = hrEmployees
      .filter(hr => hr.email && hr.id !== employee.id)
      .map(hr => hr.email);

    const pmEmployees = await this.employeeRepository.find({
      where: [
        { jobTitle: 'PM', orgId: employee.orgId, status: EmployeeStatus.ACTIVE },
        { jobTitle: 'CEO', orgId: employee.orgId, status: EmployeeStatus.ACTIVE },
        { jobTitle: 'PMO Lead', orgId: employee.orgId, status: EmployeeStatus.ACTIVE },
      ],
    });
    
    result.pmEmails = pmEmployees
      .filter(pm => pm.email && pm.id !== employee.id)
      .map(pm => pm.email);

    return result;
  }

  // HELPER METHODS

  private async calculateLeaveDays(
    startDate: Date,
    endDate: Date,
    isHalfDay: boolean,
    orgId: number
  ): Promise<number> {
    if (isHalfDay) return 0.5;

    let totalDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      totalDays++;
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalDays;
  }

  private calculateTenureMonths(joiningDate: Date | string): number {
    const today = new Date();
    const joinDate = typeof joiningDate === 'string' 
      ? new Date(joiningDate) 
      : joiningDate;
    
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
      carryForwarded: leaveType === LeaveType.ANNUAL ? 10 : 0,
    });

    return this.leaveBalanceRepository.save(balance);
  }

  async deleteLeaveBalance(employeeId: number, year: number): Promise<void> {
    await this.leaveBalanceRepository.delete({
      employee: { id: employeeId },
      year,
    });
  }

  private async createAuditLog(userId: number, action: string, leaveId: number): Promise<void> {
    console.log(`Audit: User ${userId} performed ${action} on leave ${leaveId}`);
  }

  private formatLeaveType(leaveType: string): string {
    const typeMap = {
      [LeaveType.CASUAL]: 'Casual Leave',
      [LeaveType.SICK]: 'Sick Leave',
      [LeaveType.ANNUAL]: 'Annual Leave',
      [LeaveType.MATERNITY]: 'Maternity Leave',
      [LeaveType.EMERGENCY]: 'Emergency Leave',
      [LeaveType.LOSSOFPAY]: 'Loss of Pay',
    };
    return typeMap[leaveType] || leaveType;
  }

  private formatHalfDayType(halfDayType: string): string {
    return halfDayType === 'first_half' ? 'First Half' : 'Second Half';
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return d.toLocaleDateString('en-US', options);
  }

  private getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }

  // EMAIL TEMPLATE METHODS

  private getLeaveApplicationTextTemplate(data: any): string {
    return `
Leave Application Submitted

Employee: ${data.employeeName} (${data.employeeId})
Leave Type: ${data.leaveType}
Duration: ${data.startDate} to ${data.endDate}
Number of Days: ${data.appliedDays}
Half Day: ${data.isHalfDay}
${data.isHalfDay === 'Yes' ? `Half Day Type: ${data.halfDayType}` : ''}
Reason: ${data.reason}
Applied On: ${data.applicationDate}

This leave application is pending approval.
    `.trim();
  }

  private getLeaveDecisionTextTemplate(data: any, isApproved: boolean): string {
    return `
Leave Application ${data.statusText}

Dear ${data.employeeName},

Your leave application has been ${data.statusText.toLowerCase()}.

Leave Details:
- Leave Type: ${data.leaveType}
- Duration: ${data.startDate} to ${data.endDate}
- Number of Days: ${data.appliedDays}
- Half Day: ${data.isHalfDay}
${data.isHalfDay === 'Yes' ? `- Half Day Type: ${data.halfDayType}` : ''}

${!isApproved && data.rejectionReason !== 'N/A' ? `Reason for Rejection: ${data.rejectionReason}` : ''}

Decided by: ${data.approverName}
Decision Date: ${data.decisionDate}
    `.trim();
  }

  private getLeaveApplicationEmailTemplate(data: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Leave Application</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                📋 Leave Application
              </h1>
              <p style="margin: 10px 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">
                ${data.organizationName}
              </p>
            </td>
          </tr>
          
          <!-- Status Badge -->
          <tr>
            <td style="padding: 30px 30px 0;">
              <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; border-radius: 8px;">
                <p style="margin: 0; color: #92400E; font-size: 14px; font-weight: 600;">
                  ⏳ PENDING APPROVAL
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Employee Info -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 20px; color: #1F2937; font-size: 20px; font-weight: 600;">
                Employee Information
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB;">
                    <span style="color: #6B7280; font-size: 14px;">Name:</span>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                    <span style="color: #1F2937; font-size: 14px; font-weight: 600;">${data.employeeName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB;">
                    <span style="color: #6B7280; font-size: 14px;">Employee ID:</span>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                    <span style="color: #1F2937; font-size: 14px; font-weight: 600;">${data.employeeId}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Leave Details -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h2 style="margin: 0 0 20px; color: #1F2937; font-size: 20px; font-weight: 600;">
                Leave Details
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; border-radius: 8px; padding: 20px;">
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color: #6B7280; font-size: 14px;">Leave Type:</span><br>
                    <span style="color: #1F2937; font-size: 16px; font-weight: 600;">${data.leaveType}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%" style="padding-right: 10px;">
                          <span style="color: #6B7280; font-size: 14px;">Start Date:</span><br>
                          <span style="color: #1F2937; font-size: 16px; font-weight: 600;">${data.startDate}</span>
                        </td>
                        <td width="50%" style="padding-left: 10px;">
                          <span style="color: #6B7280; font-size: 14px;">End Date:</span><br>
                          <span style="color: #1F2937; font-size: 16px; font-weight: 600;">${data.endDate}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color: #6B7280; font-size: 14px;">Number of Days:</span><br>
                    <span style="color: #667eea; font-size: 24px; font-weight: 700;">${data.appliedDays}</span>
                  </td>
                </tr>
                ${data.isHalfDay === 'Yes' ? `
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color: #6B7280; font-size: 14px;">Half Day Type:</span><br>
                    <span style="color: #1F2937; font-size: 16px; font-weight: 600;">${data.halfDayType}</span>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color: #6B7280; font-size: 14px;">Reason:</span><br>
                    <span style="color: #1F2937; font-size: 14px; line-height: 1.6;">${data.reason}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color: #6B7280; font-size: 14px;">Applied On:</span><br>
                    <span style="color: #1F2937; font-size: 14px;">${data.applicationDate}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0 0 10px; color: #6B7280; font-size: 14px;">
                This is an automated notification. Please review and approve/reject the leave application.
              </p>
              <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
                © ${new Date().getFullYear()} ${data.organizationName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private getLeaveDecisionEmailTemplate(data: any, isApproved: boolean): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Leave ${data.statusText}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${isApproved ? '#10B981' : '#EF4444'} 0%, ${isApproved ? '#059669' : '#DC2626'} 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                ${isApproved ? '✅' : '❌'} Leave ${data.statusText}
              </h1>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 30px 30px 20px;">
              <p style="margin: 0; color: #1F2937; font-size: 16px; line-height: 1.6;">
                Dear <strong>${data.employeeName}</strong>,
              </p>
              <p style="margin: 15px 0 0; color: #1F2937; font-size: 16px; line-height: 1.6;">
                Your leave application has been <strong style="color: ${data.statusColor};">${data.statusText.toLowerCase()}</strong>.
              </p>
            </td>
          </tr>
          
          <!-- Status Badge -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <div style="background-color: ${isApproved ? '#D1FAE5' : '#FEE2E2'}; border-left: 4px solid ${data.statusColor}; padding: 16px; border-radius: 8px;">
                <p style="margin: 0; color: ${isApproved ? '#065F46' : '#991B1B'}; font-size: 14px; font-weight: 600;">
                  ${isApproved ? '✓' : '✗'} ${data.statusText.toUpperCase()}
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Leave Details -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h2 style="margin: 0 0 20px; color: #1F2937; font-size: 20px; font-weight: 600;">
                Leave Details
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; border-radius: 8px; padding: 20px;">
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color: #6B7280; font-size: 14px;">Leave Type:</span><br>
                    <span style="color: #1F2937; font-size: 16px; font-weight: 600;">${data.leaveType}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%" style="padding-right: 10px;">
                          <span style="color: #6B7280; font-size: 14px;">Start Date:</span><br>
                          <span style="color: #1F2937; font-size: 16px; font-weight: 600;">${data.startDate}</span>
                        </td>
                        <td width="50%" style="padding-left: 10px;">
                          <span style="color: #6B7280; font-size: 14px;">End Date:</span><br>
                          <span style="color: #1F2937; font-size: 16px; font-weight: 600;">${data.endDate}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color: #6B7280; font-size: 14px;">Number of Days:</span><br>
                    <span style="color: ${data.statusColor}; font-size: 24px; font-weight: 700;">${data.appliedDays}</span>
                  </td>
                </tr>
                ${data.isHalfDay === 'Yes' ? `
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color: #6B7280; font-size: 14px;">Half Day Type:</span><br>
                    <span style="color: #1F2937; font-size: 16px; font-weight: 600;">${data.halfDayType}</span>
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
          
          ${!isApproved && data.rejectionReason !== 'N/A' ? `
          <!-- Rejection Reason -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <div style="background-color: #FEF2F2; border-left: 4px solid #DC2626; padding: 16px; border-radius: 8px;">
                <p style="margin: 0 0 8px; color: #991B1B; font-size: 14px; font-weight: 600;">
                  Reason for Rejection:
                </p>
                <p style="margin: 0; color: #7F1D1D; font-size: 14px; line-height: 1.6;">
                  ${data.rejectionReason}
                </p>
              </div>
            </td>
          </tr>
          ` : ''}
          
          <!-- Approval Details -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB;">
                    <span style="color: #6B7280; font-size: 14px;">Decided By:</span>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                    <span style="color: #1F2937; font-size: 14px; font-weight: 600;">${data.approverName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <span style="color: #6B7280; font-size: 14px;">Decision Date:</span>
                  </td>
                  <td style="padding: 12px 0; text-align: right;">
                    <span style="color: #1F2937; font-size: 14px; font-weight: 600;">${data.decisionDate}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0 0 10px; color: #6B7280; font-size: 14px;">
                ${isApproved 
                  ? 'Enjoy your time off! Please ensure a smooth handover before your leave.' 
                  : 'If you have any questions about this decision, please contact your manager.'}
              </p>
              <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
                This is an automated notification from the HR Management System.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

// Update leave.service.ts - Add this method to LeaveService
async applyLeaveWithValidation(employeeId: number, dto: ApplyLeaveDto): Promise<Leave> {
  const employee = await this.employeeRepository.findOne({
    where: { id: employeeId },
    relations: ['organization', 'manager'],
  });

  if (!employee) {
    throw new NotFoundException('Employee not found');
  }

  if (employee.status === EmployeeStatus.PENDING_INACTIVE) {
    throw new BadRequestException('Leave applications are not allowed during notice period');
  }

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

  // VALIDATE LEAVE DATES FOR WEEKENDS/HOLIDAYS/SANDWICHING
  const validation = await this.leaveValidationService.validateLeaveDates(
    startDate,
    endDate,
    employee.orgId,
  );

  if (!validation.isValid) {
    const errorDetails = [];
    
    if (validation.details.hasWeekends) {
      errorDetails.push(
        `Leave includes weekend days: ${validation.details.weekendDates
          .map(d => d.toDateString())
          .join(', ')}`
      );
    }
    
    if (validation.details.hasHolidays) {
      errorDetails.push(
        `Leave includes holidays: ${validation.details.holidayDates
          .map(h => `${h.name} (${h.date.toDateString()})`)
          .join(', ')}`
      );
    }
    
    if (validation.details.isSandwiching) {
      errorDetails.push(
        `Leave is sandwiching non-working days: ${validation.details.sandwichingDates
          .map(d => d.toDateString())
          .join(', ')}`
      );
    }
    
    throw new BadRequestException({
      message: validation.message,
      details: errorDetails,
    });
  }

  // Check for overlapping leaves
  const overlappingLeave = await this.leaveRepository.findOne({
    where: {
      employeeId,
      status: In([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
      startDate: LessThanOrEqual(endDate),
      endDate: MoreThanOrEqual(startDate),
    },
  });

  if (overlappingLeave) {
    throw new BadRequestException(
      `Leave already applied from ${startDate.toDateString()} to ${endDate.toDateString()}`
    );
  }

  // Get leave rule
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

  if (dto.leaveType === LeaveType.MATERNITY && employee.gender !== 'female') {
    throw new BadRequestException('Maternity leave is only applicable for female employees');
  }

  if (
    dto.leaveType === LeaveType.CASUAL ||
    dto.leaveType === LeaveType.SICK ||
    dto.leaveType === LeaveType.ANNUAL
  ) {
    const currentYear = new Date().getFullYear();
    const endYear = endDate.getFullYear();

    if (endYear > currentYear) {
      throw new BadRequestException(
        `${dto.leaveType.toUpperCase()} leave cannot be applied beyond December 31st of current year`
      );
    }
  }

  if (dto.leaveType === LeaveType.EMERGENCY && !dto.documentId) {
    throw new BadRequestException('Please upload the supporting document to apply for Emergency Leave');
  }

  const appliedDays = dto.appliedDays;
  const currentYear = new Date().getFullYear();
  
  let leaveBalance = await this.leaveBalanceRepository.findOne({
    where: {
      employee: { id: employeeId },
      leaveType: dto.leaveType as any,
      year: currentYear,
    },
  });

  if (!leaveBalance) {
    leaveBalance = await this.initializeLeaveBalance(
      employeeId,
      dto.leaveType,
      currentYear,
      leaveRule.maxAllowed
    );
  }

  const availableBalance = leaveBalance.totalAllowed - leaveBalance.used;

  if (dto.leaveType !== LeaveType.LOSSOFPAY && appliedDays > availableBalance) {
    throw new BadRequestException(
      `Insufficient leave balance. Available: ${availableBalance} days, Requested: ${appliedDays} days`
    );
  }

  leaveBalance.used = parseFloat(leaveBalance.used.toString()) + parseFloat(appliedDays.toString());
  await this.leaveBalanceRepository.save(leaveBalance);

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

  const fullLeave = await this.leaveRepository.findOne({
    where: { id: savedLeave.id },
    relations: ['employee', 'employee.manager', 'employee.organization'],
  });

  await this.sendLeaveApplicationEmail(fullLeave, employee);
  await this.createAuditLog(employeeId, 'LEAVE_APPLIED', savedLeave.id);

  return fullLeave;
}
}