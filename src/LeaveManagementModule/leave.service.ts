import { Injectable, NotFoundException, BadRequestException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Leave, LeaveStatus } from '../entities/leave.entity';
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
    private  emailService: EmailService, // Inject EmailService
  ) {}

  async createLeave(createLeaveDto: CreateLeaveDto): Promise<ResponseDto<Leave>> {
    try {
      const { employeeId, leaveType, startDate, endDate } = createLeaveDto;
      
      // Validate employee exists
      const employee = await this.employeeRepository.findOne({ where: { id: employeeId } });
      if (!employee) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'Employee not found', null);
      }
    
      // Calculate applied days correctly
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Calculate the difference in days
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const appliedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end date
      
      // Check leave balance
      const balance = await this.leaveBalancesRepository.findOne({
        where: {
          employee: { id: employeeId },
          leaveType,
          year: new Date().getFullYear(),
        },
      });
  
      if (!balance) {
        return new ResponseDto(HttpStatus.BAD_REQUEST, 'No leave balance found for this type and year', null);
      }
  
      if (balance.used + appliedDays > balance.totalAllowed) {
        return new ResponseDto(HttpStatus.BAD_REQUEST, 'Insufficient leave balance', null);
      }
      
      // Create leave with calculated appliedDays
      const leave = this.leaveRepository.create({
        ...createLeaveDto,
        appliedDays, // Use the calculated value
        employeeId: employeeId,
        approvedBy: null,
        status: createLeaveDto.status || LeaveStatus.PENDING,
      });
  
      const savedLeave = await this.leaveRepository.save(leave);

      // Send email notification
      await this.sendLeaveNotificationEmail(employee, savedLeave, leaveType,  start, end, appliedDays);
  
      return new ResponseDto(HttpStatus.CREATED, 'Leave created successfully', savedLeave);
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
      ].filter(Boolean); // Remove any undefined/null emails
      
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
  
      console.log(formattedStartDate);
      console.log(formattedEndDate);
      
  
      // Prepare email content
      const subject = `Leave Application: ${employee.firstName} ${employee.lastName} - ${leaveType}`;
      
      // Plain text version
      const text = `
        Leave Application Details:
        
        Employee: ${employee.firstName} ${employee.midName} ${employee.lastName} (${employee.email})
        Leave Type: ${leaveType}
        Duration: ${formattedStartDate} to ${formattedEndDate}
        Total Days: ${appliedDays}
        Status: ${leave.status}
        Reason: ${leave.reason || 'Not specified'}
        
        This notification was sent automatically by the HR Management System.
      `;
      
      // HTML version with better formatting and logo added to the left corner
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
            <p><strong>Total Days:</strong> ${appliedDays}</p>
            <p><strong>Status:</strong> <span style="color: #ff9800; font-weight: bold;">${leave.status}</span></p>
            <p><strong>Reason:</strong> ${leave.reason || 'Not specified'}</p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; color: #666;">
            <p style="margin-bottom: 10px;">This is an automated notification from the HR Management System.</p>
            <img src="https://public-image-file.s3.ap-south-1.amazonaws.com/Auxaitech-01.png" alt="Company Logo" style="height: 30px;">
          </div>
        </div>
      `;
  
      // Send the email with improved options
      await this.emailService.sendMail(
        reportingManager.email, // Primary recipient (employee)
        subject,
        text,
        html,
        {
          cc: ccRecipients,
          replyTo: process.env.HR_EMAIL || 'hr@company.com',
        }
      );
      
        console.log(`Leave notification email sent to ${employee.email} with ${ccRecipients.length} CC recipients`);
    } catch (emailError) {
        console.log(`Failed to send leave notification email: ${emailError.message}`, emailError.stack);
      // Don't throw the error - we don't want email failure to prevent leave creation
    }
  }
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
      
      // Calculate the difference in days (inclusive)
      const diffTime = Math.abs(end.getTime() - start.getTime());
      updateLeaveDto.appliedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) ; // +1 to include both start and end dates
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

         // Calculate applied days correctly
      
        const balance = await this.leaveBalancesRepository.findOne({
          where: {
            employee: { id: leave.employee.id },
            leaveType: leave.leaveType,
            year: new Date().getFullYear(),
          },
        });

        if (!balance) {
          return new ResponseDto(HttpStatus.BAD_REQUEST, 'No leave balance found', null);
        }
        let  delta;
        if(updateLeaveDto.appliedDays>leave.appliedDays){
           delta = updateLeaveDto.appliedDays - leave.appliedDays;

        }else{
           delta =  leave.appliedDays-updateLeaveDto.appliedDays;

        }
        if (balance.used + delta > balance.totalAllowed) {
          return new ResponseDto(HttpStatus.BAD_REQUEST, 'Insufficient leave balance', null);
        }
      
      }

      Object.assign(leave, updateLeaveDto);
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
          leaveType: leave.leaveType,
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
      leaveType: rule.leaveType, // Assume LeaveRule has a leaveType field
      used: 0,
      totalAllowed: rule.maxAllowed || 0, // Assume LeaveRule has maxDays or similar
      carryForwarded: rule.carryForwardMax||0,
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
      
      if (leave!==null) {
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
        where: { organization: { orgId } }, // Use the relationship field
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
        where: { employee: { id } }, // Filter by employee ID
        relations: ['rule'], // Ensure the 'rule' relation is loaded
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
        where: { employee: { id:employeeId} }, // Use the relationship field
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

  async updateStatusLeave(id: number, updateLeaveDto: UpdateLeaveDto): Promise<ResponseDto<Leave>> {
    try {
      const leaveResponse = await this.findLeaveById(id);
      if (leaveResponse.statusCode !== HttpStatus.OK) {
        return leaveResponse;
      }

      const leave = leaveResponse.data;

     

      if (updateLeaveDto.status === LeaveStatus.APPROVED && !updateLeaveDto.approvedBy) {
        return new ResponseDto(
          HttpStatus.BAD_REQUEST,
          'ApprovedBy must be set for approved leaves',
          null,
        );
      }
     

      
      // Handle leave balance if appliedDays changes
      if (leave.appliedDays&&updateLeaveDto.status===LeaveStatus.APPROVED) {

         // Calculate applied days correctly
      
        const balance = await this.leaveBalancesRepository.findOne({
          where: {
            employee: { id: leave.employee.id },
            leaveType: leave.leaveType,
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
        
        await this.leaveBalancesRepository.save(balance)
      
      }

      Object.assign(leave, updateLeaveDto);
      const updatedLeave = await this.leaveRepository.save(leave);

      return new ResponseDto(HttpStatus.OK, 'Leave updated successfully', updatedLeave);
    } catch (error) {
      console.error('Error updating leave:', error);
      return new ResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to update leave', null);
    }
  }
}