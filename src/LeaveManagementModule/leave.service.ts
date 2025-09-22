import { Injectable, NotFoundException, BadRequestException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Leave, LeaveStatus, LeaveType } from '../entities/leave.entity';
import { LeaveBalances } from '../entities/leave-balance.entity';
import { LeaveRule } from '../entities/leave-rule.entity';
import { EmployeeLeaveRule } from '../entities/employee-leave-rule.entity';
import { Employee } from '../entities/employees.entity';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { ResponseDto } from '../dto/response.dto';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(Leave)
    private leaveRepository: Repository<Leave>,
    @InjectRepository(LeaveBalances)
    private leaveBalancesRepository: Repository<LeaveBalances>,
    @InjectRepository(LeaveRule)
    private leaveRuleRepository: Repository<LeaveRule>,
    @InjectRepository(EmployeeLeaveRule)
    private employeeLeaveRuleRepository: Repository<EmployeeLeaveRule>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    private emailService: EmailService,
  ) {}

   /**
   * Upload file to cloud storage (S3 or similar)
   */
  async uploadFile(file: Express.Multer.File): Promise<string> {
    try {
      // This is a placeholder implementation
      // Replace with your actual file upload logic (AWS S3, Cloudinary, etc.)
      
      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `leave-attachments/${timestamp}_${randomString}.${fileExtension}`;
      
      // Mock upload URL - replace with actual implementation
      const uploadedUrl = `https://your-storage-bucket.s3.amazonaws.com/${fileName}`;
      
      // Here you would implement the actual upload logic:
      // const uploadResult = await this.s3Service.upload(file, fileName);
      // return uploadResult.Location;
      
      console.log(`File uploaded: ${file.originalname} -> ${uploadedUrl}`);
      return uploadedUrl;
      
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new BadRequestException('Failed to upload file');
    }
  }
  /**
   * Validate leave cycle restrictions for CL/SL
   */
  private validateLeaveCycleRestrictions(leaveType: string, startDate: Date, endDate: Date): string | null {
    const currentYear = new Date().getFullYear();
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    
    // Check if CL/SL is being applied beyond current year
    if ((leaveType.toLowerCase() === 'casual' || leaveType.toLowerCase() === 'sick') && 
        (startYear > currentYear || endYear > currentYear)) {
      return 'Casual Leave and Sick Leave cannot be applied beyond the current leave cycle. Please reapply in the new year.';
    }
    
    return null;
  }

  /**
   * Calculate leave days including half-day logic
   */
  private calculateLeaveDays(startDate: Date, endDate: Date, isHalfDay: boolean = false): number {
    if (isHalfDay && startDate.getTime() === endDate.getTime()) {
      return 0.5; // Half day
    }
    
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end date
  }

  /**
   * Validate carry forward rules for Annual Leave
   */
  private async validateCarryForwardRules(employeeId: number, leaveType: string, appliedDays: number, startDate: Date): Promise<{ isValid: boolean; message?: string }> {
    if (leaveType.toLowerCase() !== 'annual') {
      return { isValid: true };
    }

    const currentYear = new Date().getFullYear();
    const startYear = startDate.getFullYear();
    
    // If applying for next year, check carry forward balance
    if (startYear > currentYear) {
      const currentYearBalance = await this.leaveBalancesRepository.findOne({
        where: {
          employee: { id: employeeId },
          leaveType: LeaveType[leaveType as keyof typeof LeaveType],
          year: currentYear,
        },
      });

      if (!currentYearBalance) {
        return { isValid: false, message: 'No current year balance found for annual leave' };
      }

      // Check if sufficient carry forward balance exists
      const carryForwardAvailable = Math.min(currentYearBalance.carryForwarded || 0, 10); // Max 10 AL can be carried forward
      
      if (appliedDays > carryForwardAvailable) {
        return { isValid: false, message: `Insufficient carry forward balance. Available: ${carryForwardAvailable} days` };
      }
    }

    return { isValid: true };
  }

  async createLeave(createLeaveDto: CreateLeaveDto): Promise<ResponseDto<Leave>> {
    try {
      const { employeeId, leaveType, startDate, endDate, isHalfDay, halfDayType, attachmentUrl } = createLeaveDto;
      
      // Validate employee exists
      const employee = await this.employeeRepository.findOne({ where: { id: employeeId } });
      if (!employee) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'Employee not found', null);
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      // Validate leave cycle restrictions for CL/SL
      const cycleValidationError = this.validateLeaveCycleRestrictions(leaveType, start, end);
      if (cycleValidationError) {
        return new ResponseDto(HttpStatus.BAD_REQUEST, cycleValidationError, null);
      }

      // Validate Emergency Leave attachment requirement
      if (leaveType.toLowerCase() === 'emergency' && !attachmentUrl) {
        return new ResponseDto(HttpStatus.BAD_REQUEST, 'Please upload supporting document to apply for Emergency Leave.', null);
      }

      // Validate half-day logic
      if (isHalfDay && start.getTime() !== end.getTime()) {
        return new ResponseDto(HttpStatus.BAD_REQUEST, 'Half-day leave can only be applied for a single day', null);
      }

      // Validate half-day type for loss of pay
      if (isHalfDay && leaveType.toLowerCase() === 'lossofpay') {
        return new ResponseDto(HttpStatus.BAD_REQUEST, 'Half-day option is not available for Loss of Pay leave', null);
      }

      // Calculate applied days
      const appliedDays = this.calculateLeaveDays(start, end, isHalfDay);

      // Validate carry forward rules for Annual Leave
      const carryForwardValidation = await this.validateCarryForwardRules(employeeId, leaveType, appliedDays, start);
      if (!carryForwardValidation.isValid) {
        return new ResponseDto(HttpStatus.BAD_REQUEST, carryForwardValidation.message, null);
      }
      
      // Check leave balance
      const balance = await this.leaveBalancesRepository.findOne({
        where: {
          employee: { id: employeeId },
          leaveType: LeaveType[leaveType as keyof typeof LeaveType],
          year: start.getFullYear(),
        },
      });
  
      if (!balance) {
        return new ResponseDto(HttpStatus.BAD_REQUEST, 'No leave balance found for this type and year', null);
      }
  
      if (Number(balance.used) + appliedDays > Number(balance.totalAllowed)) {
        return new ResponseDto(HttpStatus.BAD_REQUEST, 'Insufficient leave balance', null);
      }
      
      // Create leave with calculated appliedDays
      const leave = this.leaveRepository.create({
        ...createLeaveDto,
        appliedDays,
        employeeId: employeeId,
        approvedBy: null,
        status: LeaveStatus.PENDING,
        isHalfDay: isHalfDay || false,
        halfDayType: isHalfDay ? halfDayType : null,
        attachmentUrl: attachmentUrl || null,
      });
  
      const savedLeave = await this.leaveRepository.save(leave);

      // Send email notification
      await this.sendLeaveNotificationEmail(employee, savedLeave[0], leaveType, start, end, appliedDays);
  
      return new ResponseDto(HttpStatus.CREATED, 'Leave created successfully', savedLeave[0]);
    } catch (error) {
      console.error(`Error creating leave: ${error.message}`, error.stack);
      return new ResponseDto(
        HttpStatus.INTERNAL_SERVER_ERROR,
        `Failed to create leave: ${error.message}`,
        null,
      );
    }
  }

  /**
   * Send email notification about leave application
   */
  private async sendLeaveNotificationEmail(
    employee: Employee, 
    leave: Leave, 
    leaveType: string,
    startDate: Date,
    endDate: Date,
    appliedDays: number
  ): Promise<void> {
    try {
      // Get reporting manager if exists
      const reportingManager = employee.reportTo ? 
        await this.employeeRepository.findOne({ where: { id: employee.reportTo } }) : 
        null;
      
      // Get high-level employees who should be notified
      const highLevelEmployees = await this.employeeRepository.find({
        where: [
          { jobTitle: 'PM' },
          { jobTitle: 'HR Executive' },
          { jobTitle: 'CEO' },
          { department: employee.department },
        ],
        select: ['email'],
      });
  
      // Prepare recipients
      const ccRecipients: string[] = [
        ...highLevelEmployees.map(emp => emp.email),
      ].filter(Boolean);
      
      // Format dates for better readability
      const formattedStartDate = startDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      const formattedEndDate = endDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
  
      // Prepare email content
      const subject = `Leave Application: ${employee.firstName} ${employee.lastName} - ${leaveType}`;
      
      // Plain text version
      const text = `
        Leave Application Details:
        
        Employee: ${employee.firstName} ${employee.midName} ${employee.lastName} (${employee.email})
        Leave Type: ${leaveType}
        Duration: ${formattedStartDate} to ${formattedEndDate}
        Total Days: ${appliedDays}${leave.isHalfDay ? ` (Half Day - ${leave.halfDayType})` : ''}
        Status: ${leave.status}
        Reason: ${leave.reason || 'Not specified'}
        ${leave.attachmentUrl ? `Supporting Document: ${leave.attachmentUrl}` : ''}
        
        This notification was sent automatically by the HR Management System.
      `;
      
      // HTML version with better formatting
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="display: flex; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">
            <img src="https://public-image-file.s3.ap-south-1.amazonaws.com/Auxaitech-01.png" alt="Company Logo" style="height: 40px; margin-right: 20px;">
            <h2 style="color: #333; margin: 0;">Leave Application Submitted</h2>
          </div>
          
          <div style="margin: 20px 0;">
            <p><strong>Employee:</strong> ${employee.firstName} ${employee.lastName} (${employee.email})</p>
            <p><strong>Department:</strong> ${employee.department || 'Not specified'}</p>
            <p><strong>Leave Type:</strong> ${leaveType}</p>
            <p><strong>From:</strong> ${formattedStartDate}</p>
            <p><strong>To:</strong> ${formattedEndDate}</p>
            <p><strong>Total Days:</strong> ${appliedDays}${leave.isHalfDay ? ` (Half Day - ${leave.halfDayType})` : ''}</p>
            <p><strong>Status:</strong> <span style="color: #ff9800; font-weight: bold;">${leave.status}</span></p>
            <p><strong>Reason:</strong> ${leave.reason || 'Not specified'}</p>
            ${leave.attachmentUrl ? `<p><strong>Supporting Document:</strong> <a href="${leave.attachmentUrl}">View Document</a></p>` : ''}
          </div>
          
          <div style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; color: #666;">
            <p style="margin-bottom: 10px;">This is an automated notification from the HR Management System.</p>
            <img src="https://public-image-file.s3.ap-south-1.amazonaws.com/Auxaitech-01.png" alt="Company Logo" style="height: 30px;">
          </div>
        </div>
      `;
  
      // Send the email
      if (reportingManager) {
        await this.emailService.sendMail(
          reportingManager.email,
          subject,
          text,
          html,
          {
            cc: ccRecipients,
            replyTo: process.env.HR_EMAIL || 'hr@company.com',
          }
        );
      }
      
      console.log(`Leave notification email sent with ${ccRecipients.length} CC recipients`);
    } catch (emailError) {
      console.log(`Failed to send leave notification email: ${emailError.message}`, emailError.stack);
    }
  }

  // Rest of the methods remain the same...
  async findAllLeaves(): Promise<ResponseDto<Leave[]>> {
    try {
      const leaves = await this.leaveRepository.find({
        relations: ['employee', 'approvedBy'],
      });

      if (!leaves || leaves.length === 0) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'No leaves found', []);
      }

      return new ResponseDto(HttpStatus.OK, 'Leaves retrieved successfully', leaves);
    } catch (error) {
      console.error('Error retrieving leaves:', error);
      return new ResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve leaves', null);
    }
  }

  async findLeaveById(id: number): Promise<ResponseDto<Leave>> {
    try {
      const leave = await this.leaveRepository.findOne({
        where: { id },
        relations: ['employee'],
      });

      if (!leave) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'Leave not found', null);
      }

      return new ResponseDto(HttpStatus.OK, 'Leave retrieved successfully', leave);
    } catch (error) {
      console.error('Error retrieving leave:', error);
      return new ResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve leave', null);
    }
  }

  async updateLeave(id: number, updateLeaveDto: UpdateLeaveDto): Promise<ResponseDto<Leave>> {
    try {
      const leaveResponse = await this.findLeaveById(id);
      if (leaveResponse.statusCode !== HttpStatus.OK) {
        return leaveResponse;
      }

      const leave = leaveResponse.data;

      // Calculate appliedDays if startDate and endDate are provided in updateLeaveDto
      if (updateLeaveDto.startDate && updateLeaveDto.endDate) {
        const start = new Date(updateLeaveDto.startDate);
        const end = new Date(updateLeaveDto.endDate);
        
        // Validate leave cycle restrictions for CL/SL
        const cycleValidationError = this.validateLeaveCycleRestrictions(leave.leaveType, start, end);
        if (cycleValidationError) {
          return new ResponseDto(HttpStatus.BAD_REQUEST, cycleValidationError, null);
        }

        // Calculate the difference in days (inclusive)
        updateLeaveDto.appliedDays = this.calculateLeaveDays(start, end, updateLeaveDto.isHalfDay);
      }

      if (updateLeaveDto.status === LeaveStatus.APPROVED && !updateLeaveDto.approvedBy) {
        return new ResponseDto(
          HttpStatus.BAD_REQUEST,
          'ApprovedBy must be set for approved leaves',
          null,
        );
      }
     
      // Handle leave balance if appliedDays changes
      if (updateLeaveDto.appliedDays && updateLeaveDto.appliedDays !== leave.appliedDays) {
        const balance = await this.leaveBalancesRepository.findOne({
          where: {
            employee: { id: leave.employee.id },
            leaveType: LeaveType[leave.leaveType as keyof typeof LeaveType],
            year: new Date().getFullYear(),
          },
        });

        if (!balance) {
          return new ResponseDto(HttpStatus.BAD_REQUEST, 'No leave balance found', null);
        }
        
        let delta;
        if(updateLeaveDto.appliedDays > leave.appliedDays){
          delta = updateLeaveDto.appliedDays - leave.appliedDays;
        } else {
          delta = leave.appliedDays - updateLeaveDto.appliedDays;
        }
        
        if (balance.used + delta > balance.totalAllowed) {
          return new ResponseDto(HttpStatus.BAD_REQUEST, 'Insufficient leave balance', null);
        }
      }

      Object.assign(leave, updateLeaveDto);
      console.log(leave);
      
      const updatedLeave = await this.leaveRepository.save(leave);

      return new ResponseDto(HttpStatus.OK, 'Leave updated successfully', updatedLeave);
    } catch (error) {
      console.error('Error updating leave:', error);
      return new ResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to update leave', null);
    }
  }

  async deleteLeave(id: number): Promise<ResponseDto<void>> {
    try {
      const leaveResponse = await this.findLeaveById(id);
      if (leaveResponse.statusCode !== HttpStatus.OK) {
        return new ResponseDto(leaveResponse.statusCode, leaveResponse.message, null);
      }

      const leave = leaveResponse.data;

      // Revert leave balance
      const balance = await this.leaveBalancesRepository.findOne({
        where: {
          employee: { id: leave.employee.id },
          leaveType: LeaveType[leave.leaveType as keyof typeof LeaveType],
          year: new Date().getFullYear(),
        },
      });

      if (balance) {
        balance.used -= leave.appliedDays;
        await this.leaveBalancesRepository.save(balance);
      }

      await this.leaveRepository.remove(leave);

      return new ResponseDto(HttpStatus.OK, 'Leave deleted successfully', null);
    } catch (error) {
      console.error('Error deleting leave:', error);
      return new ResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete leave', null);
    }
  }

  async assignLeaveRule(employeeId: number, ruleId: number): Promise<ResponseDto<EmployeeLeaveRule>> {
    const queryRunner = this.employeeLeaveRuleRepository.manager.connection.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      // Validate employee and rule
      const employee = await queryRunner.manager.findOne(Employee, { where: { id: employeeId } });
      if (!employee) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'Employee not found', null);
      }

      const rule = await queryRunner.manager.findOne(LeaveRule, { where: { id: ruleId } });
      if (!rule) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'Leave rule not found', null);
      }

      // Check if assignment already exists
      const existingAssignment = await queryRunner.manager.findOne(EmployeeLeaveRule, {
        where: { employee: { id: employeeId }, rule: { id: ruleId } },
      });
      if (existingAssignment) {
        return new ResponseDto(HttpStatus.BAD_REQUEST, 'Leave rule already assigned to employee', null);
      }

      // Create and save EmployeeLeaveRule
      const assignment = this.employeeLeaveRuleRepository.create({
        employee: { id: employeeId },
        rule: { id: ruleId },
      });
      const savedAssignment = await queryRunner.manager.save(assignment);

      // Create and save LeaveBalance with predefined values
      const leaveBalance = this.leaveBalancesRepository.create({
        employee: { id: employeeId },
        leaveType: rule.leaveType,
        used: 0,
        totalAllowed: rule.maxAllowed || 0,
        carryForwarded: rule.carryForwardMax || 0,
        year: new Date().getFullYear(),
      });
      await queryRunner.manager.save(leaveBalance);

      // Commit transaction
      await queryRunner.commitTransaction();

      return new ResponseDto(HttpStatus.CREATED, 'Leave rule assigned successfully', savedAssignment);
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      console.error('Error assigning leave rule:', error.message || error);
      return new ResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to assign leave rule', null);
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  async unassignLeaveRule(employeeId: number, ruleId: number): Promise<ResponseDto<boolean>> {
    const queryRunner = this.employeeLeaveRuleRepository.manager.connection.createQueryRunner();
    await queryRunner.startTransaction();
  
    try {
      // Check if assignment exists
      const existingAssignment = await queryRunner.manager.findOne(EmployeeLeaveRule, {
        where: { employee: { id: employeeId }, rule: { id: ruleId } },
        relations: ['rule'],
      });
      
      if (!existingAssignment) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'Leave rule is not assigned to this employee', false);
      }
  
      // Find the associated leave balance
      const leaveBalance = await queryRunner.manager.findOne(LeaveBalances, {
        where: { 
          employee: { id: employeeId },
          leaveType: existingAssignment.rule.leaveType,
          year: new Date().getFullYear(),
        },
      });

      const leave = await queryRunner.manager.findOne(Leave, {
        where: { 
          employee: { id: employeeId },
          leaveType: existingAssignment.rule.leaveType,
        },
      });
      
      if (leave !== null) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'Rule cannot be unassigned as leaves are present for this rule', false);
      }
      
      // Remove the assignment
      await queryRunner.manager.remove(existingAssignment);
      
      // Remove the associated leave balance if found
      if (leaveBalance) {
        await queryRunner.manager.remove(leaveBalance);
      }
      
      // Commit transaction
      await queryRunner.commitTransaction();
      return new ResponseDto(HttpStatus.OK, 'Leave rule unassigned successfully', true);
      
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      console.error('Error unassigning leave rule:', error.message || error);
      return new ResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to unassign leave rule', false);
      
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  async findLeaveByEmployee(id: number): Promise<ResponseDto<Leave[]>> {
    try {
      const leave = await this.leaveRepository.find({
        where: { employeeId: id },
        relations: ['employee'],
      });

      if (!leave) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'Leaves not found', null);
      }

      return new ResponseDto(HttpStatus.OK, 'Leaves retrieved successfully', leave);
    } catch (error) {
      console.error('Error retrieving leaves:', error);
      return new ResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve leaves', null);
    }
  }

  async findAllRules(orgId: number): Promise<ResponseDto<LeaveRule[]>> {
    try {
      const leaveRules = await this.leaveRuleRepository.find({
        where: { organization: { orgId } },
      });
  
      if (leaveRules.length === 0) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'No rules found for the organization', []);
      }
  
      return new ResponseDto(HttpStatus.OK, 'Rules retrieved successfully', leaveRules);
    } catch (error) {
      console.error('Error retrieving rules:', error);
      return new ResponseDto(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Failed to retrieve rules',
        null
      );
    }
  }

  async findLeaveRulesByEmployee(id: number): Promise<ResponseDto<EmployeeLeaveRule[]>> {
    try {
      const leaveRules = await this.employeeLeaveRuleRepository.find({
        where: { employee: { id } },
        relations: ['rule'],
      });
  
      if (!leaveRules || leaveRules.length === 0) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'No leave rules found for the employee', []);
      }
  
      return new ResponseDto(HttpStatus.OK, 'Leave rules retrieved successfully', leaveRules);
    } catch (error) {
      console.error('Error retrieving leave rules:', error.message || error);
      return new ResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve leave rules', null);
    }
  } 

  async findLeaveBalanceByEmp(employeeId: number): Promise<ResponseDto<LeaveBalances[]>> {
    try {
      const leaveRules = await this.leaveBalancesRepository.find({
        where: { employee: { id: employeeId } },
      });
  
      if (leaveRules.length === 0) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'No rules found for the organization', []);
      }
  
      return new ResponseDto(HttpStatus.OK, 'Leave balances retrieved successfully', leaveRules);
    } catch (error) {
      console.error('Error retrieving leave balances:', error);
      return new ResponseDto(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Failed to retrieve leave balances',
        null
      );
    }
  }

  private async sendLeaveStatusUpdateEmail(
    employee: Employee, 
    leave: Leave, 
    approvedBy?: Employee
  ): Promise<void> {
    try {
      // Format dates for better readability
      const formattedStartDate = new Date(leave.startDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      const formattedEndDate = new Date(leave.endDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Determine status color and message
      const getStatusColor = (status: LeaveStatus): string => {
        switch (status) {
          case LeaveStatus.APPROVED: return '#4CAF50';
          case LeaveStatus.REJECTED: return '#F44336';
          case LeaveStatus.PENDING: return '#FF9800';
          default: return '#757575';
        }
      };

      const getStatusMessage = (status: LeaveStatus): string => {
        switch (status) {
          case LeaveStatus.APPROVED: return 'Your leave application has been approved! 🎉';
          case LeaveStatus.REJECTED: return 'Your leave application has been rejected.';
          case LeaveStatus.PENDING: return 'Your leave application is pending review.';
          default: return 'Your leave application status has been updated.';
        }
      };

      // Prepare email content
      const subject = `Leave ${leave.status}: ${leave.leaveType} - ${formattedStartDate} to ${formattedEndDate}`;
      
      // Plain text version
      const text = `
        Dear ${employee.firstName} ${employee.lastName},
        
        ${getStatusMessage(leave.status)}
        
        Leave Application Details:
        Employee: ${employee.firstName} ${employee.midName || ''} ${employee.lastName}
        Leave Type: ${leave.leaveType}
        Duration: ${formattedStartDate} to ${formattedEndDate}
        Total Days: ${leave.appliedDays}
        Current Status: ${leave.status}
        ${approvedBy ? `Processed by: ${approvedBy.firstName} ${approvedBy.lastName}` : ''}
        Reason: ${leave.reason || 'Not specified'}
        
        ${leave.status === LeaveStatus.APPROVED ? 
          'Please ensure proper handover of your responsibilities before your leave begins.' : 
          leave.status === LeaveStatus.REJECTED ? 
          'If you have any questions about this decision, please contact your manager or HR.' : 
          'You will be notified once your leave application is reviewed.'
        }
        
        This notification was sent automatically by the HR Management System.
      `;
      
      // HTML version with better formatting
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="display: flex; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">
            <img src="https://public-image-file.s3.ap-south-1.amazonaws.com/Auxaitech-01.png" alt="Company Logo" style="height: 40px; margin-right: 20px;">
            <h2 style="color: #333; margin: 0;">Leave Status Update</h2>
          </div>
          
          <div style="margin: 20px 0;">
            <p style="font-size: 16px; color: #333;">Dear ${employee.firstName} ${employee.lastName},</p>
            <p style="font-size: 16px; font-weight: bold; color: ${getStatusColor(leave.status)};">
              ${getStatusMessage(leave.status)}
            </p>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Leave Application Details:</h3>
            <p><strong>Employee:</strong> ${employee.firstName} ${employee.lastName}</p>
            <p><strong>Department:</strong> ${employee.department || 'Not specified'}</p>
            <p><strong>Leave Type:</strong> ${leave.leaveType}</p>
            <p><strong>From:</strong> ${formattedStartDate}</p>
            <p><strong>To:</strong> ${formattedEndDate}</p>
            <p><strong>Total Days:</strong> ${leave.appliedDays}</p>
            <p><strong>Current Status:</strong> <span style="color: ${getStatusColor(leave.status)}; font-weight: bold;">${leave.status}</span></p>
            ${approvedBy ? `<p><strong>Processed by:</strong> ${approvedBy.firstName} ${approvedBy.lastName}</p>` : ''}
            <p><strong>Reason:</strong> ${leave.reason || 'Not specified'}</p>
          </div>
          
          ${leave.status === LeaveStatus.APPROVED ? 
            '<div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; border-left: 4px solid #4CAF50; margin: 20px 0;"><p style="margin: 0; color: #2e7d32;"><strong>Next Steps:</strong> Please ensure proper handover of your responsibilities before your leave begins.</p></div>' : 
            leave.status === LeaveStatus.REJECTED ? 
            '<div style="background-color: #ffebee; padding: 15px; border-radius: 5px; border-left: 4px solid #F44336; margin: 20px 0;"><p style="margin: 0; color: #c62828;">If you have any questions about this decision, please contact your manager or HR department.</p></div>' : 
            '<div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; border-left: 4px solid #FF9800; margin: 20px 0;"><p style="margin: 0; color: #ef6c00;">You will be notified once your leave application is reviewed.</p></div>'
          }
          
          <div style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; color: #666; margin-top: 20px;">
            <p style="margin-bottom: 10px;">This is an automated notification from the HR Management System.</p>
            <img src="https://public-image-file.s3.ap-south-1.amazonaws.com/Auxaitech-01.png" alt="Company Logo" style="height: 30px;">
          </div>
        </div>
      `;

      // Send the email to the employee
      await this.emailService.sendMail(
        employee.email, // Primary recipient (employee who applied for leave)
        subject,
        text,
        html,
        {
          replyTo: process.env.HR_EMAIL || 'hr@company.com',
        }
      );
      
      console.log(`Leave status update email sent to ${employee.email} - Status: ${leave.status}`);
    } catch (emailError) {
      console.error(`Failed to send leave status update email: ${emailError.message}`, emailError.stack);
      // Don't throw the error - we don't want email failure to prevent status update
    }
  }

  async updateStatusLeave(id: number, updateLeaveDto: UpdateLeaveDto): Promise<ResponseDto<Leave>> {
    try {
      const leaveResponse = await this.findLeaveById(id);
      if (leaveResponse.statusCode !== HttpStatus.OK) {
        return leaveResponse;
      }

      const leave = leaveResponse.data;
      const previousStatus = leave.status; // Store previous status for email notification

      if (updateLeaveDto.status === LeaveStatus.APPROVED && !updateLeaveDto.approvedBy) {
        return new ResponseDto(
          HttpStatus.BAD_REQUEST,
          'ApprovedBy must be set for approved leaves',
          null,
        );
      }

      // Handle leave balance if status is being approved
      if (leave.appliedDays && updateLeaveDto.status === LeaveStatus.APPROVED) {
        const balance = await this.leaveBalancesRepository.findOne({
          where: {
            employee: { id: leave.employee.id },
            leaveType: LeaveType[leave.leaveType as keyof typeof LeaveType],
            year: new Date().getFullYear(),
          },
        });

        if (!balance) {
          return new ResponseDto(HttpStatus.BAD_REQUEST, 'No leave balance found', null);
        }
        
        balance.used = Number(balance.used) + Number(leave.appliedDays);
        
        if (balance.used > balance.totalAllowed) {
          return new ResponseDto(HttpStatus.BAD_REQUEST, 'Insufficient leave balance', null);
        }
        
        await this.leaveBalancesRepository.save(balance);
      }

      // Get approver information if approvedBy is provided
      let approver: Employee | null = null;
      if (updateLeaveDto.approvedBy) {
        approver = await this.employeeRepository.findOne({ 
          where: { id: updateLeaveDto.approvedBy } 
        });
      }

      // Update leave status
      Object.assign(leave, updateLeaveDto);
      const updatedLeave = await this.leaveRepository.save(leave);

      // Send email notification to employee about status change
      if (previousStatus !== updateLeaveDto.status && updateLeaveDto.status) {
        await this.sendLeaveStatusUpdateEmail(
          leave.employee, 
          updatedLeave, 
          approver
        );
      }

      return new ResponseDto(HttpStatus.OK, 'Leave status updated successfully', updatedLeave);
    } catch (error) {
      console.error('Error updating leave status:', error);
      return new ResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to update leave status', null);
    }
  }

  async findPendingLeavesByEmployees(employeeIds: number[]): Promise<ResponseDto<Leave[]>> {
    const leaves = await this.leaveRepository.find({
      where: {
        employeeId: In(employeeIds),
        status: LeaveStatus.PENDING,
      },
      relations: ['employee'], 
    });
    return { 
      statusCode: HttpStatus.OK,
      data: leaves, 
      message: 'Pending leaves for employees retrieved successfully' 
    };
  }

}