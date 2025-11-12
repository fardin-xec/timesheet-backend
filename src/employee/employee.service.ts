import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Employee, EmployeeStatus, InactivationReason } from '../entities/employees.entity';
import { PersonalService } from 'src/personal/personal.service';
import { UsersService } from 'src/user/user.service';
import { BankInfoService } from 'src/bank-info/bank-info.service';
import { LeaveStatus } from 'src/entities/leave.entity';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { AuditTrailService } from 'src/audit-trail/audit-trail.service';
import { UserRole } from 'src/entities/users.entity';
import { EmailService } from 'src/email/smtpEmail.service';
import { PayrollService } from 'src/payroll/payroll.service';
import { LeaveService } from 'src/LeaveManagementModule/leave.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CheckExistenceDto } from './dto/create-employee.dto';
import { LeaveRule } from 'src/entities/leave-rule.entity';
import { EmployeeLeaveRule } from 'src/entities/employee-leave-rule.entity';
import { LeaveFilterDto } from 'src/LeaveManagementModule/dto/create-leave.dto';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

@Injectable()
export class EmployeeService {
  private readonly uploadPath = path.join(process.cwd(), 'uploads', 'avatars');


  constructor(
    @InjectRepository(Employee) private employeeRepository: Repository<Employee>,
    @InjectRepository(LeaveRule) private leaveRuleRepository: Repository<LeaveRule>,
    @InjectRepository(EmployeeLeaveRule) private employeeLeaveRuleRepository: Repository<EmployeeLeaveRule>,
    private personalService: PersonalService,
    private userService: UsersService,
    private bankInfoService: BankInfoService,
    private auditTrailService: AuditTrailService,
    private emailService:EmailService,
    private payrollService: PayrollService,
    private leaveService:LeaveService,
    private dataSource: DataSource, // Inject DataSource for transaction management


  ) {
    // Ensure upload directory exists
    this.ensureUploadDirectory();
  }

 


  private async ensureUploadDirectory(): Promise<void> {
    try {
      await mkdir(this.uploadPath, { recursive: true });
    } catch (error) {
      console.error('Error creating upload directory:', error);
    }
  }

  /**
   * Check if the string is a base64 image
   */
   isBase64Image(str: string): boolean {
    if (!str) return false;
    return str.startsWith('data:image/');
  }

  /**
   * Extract base64 data and mime type from data URI
   */
   parseBase64Image(dataUri: string): { data: Buffer; ext: string } | null {
    try {
      // Extract mime type and base64 data
      const matches = dataUri.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
      if (!matches) return null;

      const mimeType = matches[1]; // jpeg, png, gif, webp
      const base64Data = matches[2];

      // Map mime types to file extensions
      const extMap: { [key: string]: string } = {
        'jpeg': 'jpg',
        'jpg': 'jpg',
        'png': 'png',
        'gif': 'gif',
        'webp': 'webp',
        'svg+xml': 'svg',
      };

      const ext = extMap[mimeType] || 'jpg';
      const data = Buffer.from(base64Data, 'base64');

      return { data, ext };
    } catch (error) {
      console.error('Error parsing base64 image:', error);
      return null;
    }
  }

  /**
   * Save base64 image to file system
   */
   async saveBase64Image(base64Data: string, employeeId: string): Promise<string> {
    try {
      const imageData = this.parseBase64Image(base64Data);
      if (!imageData) {
        throw new Error('Invalid base64 image data');
      }

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `avatar-${employeeId}-${timestamp}.${imageData.ext}`;
      const filePath = path.join(this.uploadPath, filename);

      // Write file to disk
      await writeFile(filePath, new Uint8Array(imageData.data));

      // Return relative path that can be used in URLs
      return `/uploads/avatars/${filename}`;
    } catch (error) {
      console.error('Error saving base64 image:', error);
      throw new Error('Failed to save avatar image');
    }
  }

  /**
   * Delete old avatar file from file system
   */
   async deleteOldAvatar(avatarPath: string): Promise<void> {
    try {
      // Only delete if it's a local file path (not URL or base64)
      if (!avatarPath || avatarPath.startsWith('http') || avatarPath.startsWith('data:')) {
        return;
      }

      // Extract filename from path
      const filename = path.basename(avatarPath);
      const filePath = path.join(this.uploadPath, filename);

      // Check if file exists and delete it
      if (fs.existsSync(filePath)) {
        await unlink(filePath);
        console.log(`Deleted old avatar: ${filename}`);
      }
    } catch (error) {
      console.error('Error deleting old avatar:', error);
      // Don't throw error, just log it
    }
  }

  findAll(): Promise<Employee[]> {
    return this.employeeRepository.find();
  }

  findOne(id: number): Promise<Employee> {
    return this.employeeRepository.findOneBy({ id });
  }

  findByUser(id: number): Promise<Employee> {
    return this.employeeRepository.findOneBy({ userId: id });
  }



  /**
   * Generate next employee ID
   */
  private async generateEmployeeId(): Promise<string> {
    const lastEmployee = await this.employeeRepository
      .createQueryBuilder('employee')
      .orderBy('employee.employeeId', 'DESC')
      .getOne();

    let newEmployeeId = 'AT-0001';
    if (lastEmployee && lastEmployee.employeeId) {
      const lastIdNumber = parseInt(lastEmployee.employeeId.split('-')[1], 10);
      const newIdNumber = (lastIdNumber + 1).toString().padStart(4, '0');
      newEmployeeId = `AT-${newIdNumber}`;
    }

    return newEmployeeId;
  }

  /**
   * Map role string to UserRole enum
   */
  mapRoleToUserRole(role: string): UserRole {
    const roleLowercase = role.toLowerCase().trim();

    const roleMap: Record<string, UserRole> = {
      'admin': UserRole.ADMIN,
      'manager': UserRole.MANAGER,
      'user': UserRole.USER,
    };

    return roleMap[roleLowercase] || UserRole.USER;
  }

  /**
   * Determine user role based on designation
   */
  private determineUserRole(designation: string, baseRole: UserRole): UserRole {
    const managerDesignations = ['Manager', 'Lead', 'Senior', 'Director', 'VP'];
    
    if (managerDesignations.includes(designation) && baseRole === UserRole.USER) {
      return UserRole.MANAGER;
    }
    
    return baseRole;
  }

  /**
   * Create employee with transaction support
   */
  async createEmployeeWithTransaction(
    employeeData: Partial<Employee>,
    userData: any,
    bankInfoData: any,
    payloadUserId: number,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Step 1: Validate email and phone uniqueness
      const existingEmployee = await queryRunner.manager.findOne(Employee, {
        where: [
          { email: employeeData.email },
          { phone: employeeData.phone },
        ],
      });

      if (existingEmployee) {
        throw new BadRequestException('Employee with this email or phone already exists');
      }

      // Step 2: Generate employee ID
      const employeeId = await this.generateEmployeeId();
      employeeData.employeeId = employeeId;

      // Step 3: Determine final user role
      const finalRole = this.determineUserRole(
        employeeData.designation as string,
        userData.role,
      );
      userData.role = finalRole;

      // Step 4: Create user account
      const user = await this.userService.createWithQueryRunner(userData, queryRunner);

      // Step 5: Create employee record
      employeeData.userId = user.id;
      const employee = queryRunner.manager.create(Employee, employeeData);
      const savedEmployee = await queryRunner.manager.save(Employee, employee);

      // Step 6: Create bank information
      let bankInfo = null;
      if (bankInfoData && Object.keys(bankInfoData).length > 0) {
        bankInfoData.employeeId = savedEmployee.id;
        bankInfo = await this.bankInfoService.createWithQueryRunner(
          bankInfoData,
          queryRunner,
        );
      }

      // Step 7: Assign leave rules
      await this.assignLeaveRulesWithQueryRunner(savedEmployee, queryRunner);

      // Step 8: Create audit trail
      await this.auditTrailService.logEmployeeCreationWithQueryRunner(
        savedEmployee,
        payloadUserId,
        queryRunner,
      );

      // Commit transaction
      await queryRunner.commitTransaction();

      return {
        employee: savedEmployee,
        user,
        bankInfo,
      };
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      console.error('Transaction failed, rolling back:', error);
      
      throw new InternalServerErrorException(
        `Failed to create employee: ${error.message}`,
      );
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

    /**
   * Assign leave rules with query runner
   */
  private async assignLeaveRulesWithQueryRunner(
    employee: Employee,
    queryRunner: any,
  ): Promise<void> {
    const leaveRules = await queryRunner.manager.find(LeaveRule, {
      where: { isActive: true },
    });

    let rulesToAssign: LeaveRule[] = [];

    if (employee.isProbation) {
      const lossOfPayRule = leaveRules.find(
        (rule) => rule.leaveType === 'lossOfPay',
      );
      if (lossOfPayRule) rulesToAssign = [lossOfPayRule];
    } else {
      if (employee.gender === 'female') {
        rulesToAssign = leaveRules;
      } else {
        rulesToAssign = leaveRules.filter(
          (rule) => rule.leaveType !== 'maternity',
        );
      }
    }
  }
  async update(id: number, employeeData: Partial<Employee>): Promise<Employee> {
    try {
      // Get existing employee data
      const existingEmployee = await this.findOne(id);
      if (!existingEmployee) {
        throw new Error('Employee not found');
      }

      // Check if isProbation or gender is being updated
    const isProbationChanged = employeeData.isProbation !== undefined && 
                                employeeData.isProbation !== existingEmployee.isProbation;
    const isGenderChanged = employeeData.gender !== undefined && 
                             employeeData.gender !== existingEmployee.gender;

      // Handle avatar if provided
      if (employeeData.avatar) {
        // Check if avatar is base64 image
        if (this.isBase64Image(employeeData.avatar)) {
          // Delete old avatar if it exists and is a local file
          if (existingEmployee.avatar) {
            await this.deleteOldAvatar(existingEmployee.avatar);
          }

          // Save new base64 image and get file path
          const avatarPath = await this.saveBase64Image(employeeData.avatar, existingEmployee.employeeId);
          employeeData.avatar = avatarPath;
        }
        // If it's a URL or existing path, keep it as is
      }

      const user = await this.userService.findOne(employeeData.userId);
      if(employeeData.designation!=="Junior"&&employeeData.designation!=="C-Level"&&employeeData.designation!=="Mid-level"){
        
        if(user.role===UserRole.USER){
          user.role=UserRole.MANAGER;
          await this.userService.update(user.id,user);
        }
      }else{
        if(user.role===UserRole.MANAGER){
          user.role=UserRole.USER;
          await this.userService.update(user.id,user);
        }
      }

      // Update employee data
      await this.employeeRepository.update(id, employeeData);

      const updatedEmployee = await this.findOne(id)

      // Reassign leave rules if isProbation or gender changed
    if (isProbationChanged || isGenderChanged) {
      const filter: LeaveFilterDto ={
        status: LeaveStatus.APPROVED
      }
      const employeeLeave = await this.leaveService.getEmployeeLeaves(employeeData.id,filter)
      if(employeeLeave.length===0){
        await this.reassignLeaveRules(updatedEmployee);
      }

    }

       await this.auditTrailService.logEmployeeUpdate(
          updatedEmployee,
          existingEmployee,
          updatedEmployee.userId,
          
        );
      return updatedEmployee;
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  }
async reassignLeaveRules(employee: Employee): Promise<void> {
   
  const currentYear = new Date().getFullYear();
  // Step 1: Remove all existing leave rule assignments for this employee
  await this.employeeLeaveRuleRepository.delete({
    employee: { id: employee.id },
  });

  await this.leaveService.deleteLeaveBalance(employee.id,currentYear)

  // Step 2: Get all active leave rules
  const leaveRules = await this.leaveRuleRepository.find({
    where: { isActive: true },
  });

  let rulesToAssign: LeaveRule[] = [];

  // Step 3: Decide which rules to assign
  if (employee.isProbation) {
    // If on probation, assign only lossOfPay
    const lossOfPayRule = leaveRules.find(
      (rule) => rule.leaveType === 'lossOfPay',
    );
    if (lossOfPayRule) rulesToAssign = [lossOfPayRule];
  } else {
    // Not on probation
    if (employee.gender === 'female') {
      // Female: assign all leave types
      rulesToAssign = leaveRules;
    } else {
      // Male: assign all except maternity leave
      rulesToAssign = leaveRules.filter(
        (rule) => rule.leaveType !== 'maternity',
      );
    }
  }

  // Step 4: Create new employee leave rule entries
  const employeeLeaveRules = rulesToAssign.map((rule) =>
    this.employeeLeaveRuleRepository.create({
      employee: employee,
      rule: rule,
      assignedAt: new Date(),
    }),
  );

  // Step 5: Save the new rules
  const savedRules = await this.employeeLeaveRuleRepository.save(
    employeeLeaveRules,
  );

  // Step 6: Initialize or update leave balances for the current year
  

  for (const assignedRule of savedRules) {
    const totalAllowed =
      assignedRule.customMaxAllowed ??
      assignedRule.rule.maxAllowed ??
      0;

    await this.leaveService.initializeLeaveBalance(
      employee.id,
      assignedRule.rule.leaveType,
      currentYear,
      Number(totalAllowed),
    );
  }
}

  private async assignLeaveRules(employee: Employee): Promise<void> {
  // Step 1: Get all active leave rules
  const leaveRules = await this.leaveRuleRepository.find({
    where: { isActive: true },
  });

  let rulesToAssign: LeaveRule[] = [];

  // Step 2: Filter rules based on employee conditions
  if (employee.isProbation) {
    // If on probation, assign only lossOfPay
    const lossOfPayRule = leaveRules.find(
      (rule) => rule.leaveType === 'lossOfPay',
    );
    if (lossOfPayRule) rulesToAssign = [lossOfPayRule];
  } else {
    // Not on probation
    if (employee.gender === 'female') {
      // Female: assign all leave types
      rulesToAssign = leaveRules;
    } else {
      // Male: assign all except maternity leave
      rulesToAssign = leaveRules.filter(
        (rule) => rule.leaveType !== 'maternity',
      );
    }
  }

  // Step 3: Create employee leave rule records
  const employeeLeaveRules = rulesToAssign.map((rule) =>
    this.employeeLeaveRuleRepository.create({
      employee: employee,
      rule: rule,
      assignedAt: new Date(),
    }),
  );

  // Step 4: Save all employee leave rules
  const savedRules = await this.employeeLeaveRuleRepository.save(
    employeeLeaveRules,
  );
  
  // Step 5: Initialize leave balances for each rule
  const currentYear = new Date().getFullYear();

  for (const assignedRule of savedRules) {
    const totalAllowed =
      assignedRule.rule.maxAllowed ??
      assignedRule.customMaxAllowed ??
      0;

    await this.leaveService.initializeLeaveBalance(
      employee.id,
      assignedRule.rule.leaveType,
      currentYear,
      Number(totalAllowed),
    );
  }
}


  async remove(id: number): Promise<void> {
    const employee = await this.findOne(id);
    if (employee !== null) {
      // Delete avatar file if it exists
      if (employee.avatar) {
        await this.deleteOldAvatar(employee.avatar);
      }

      const personal = await this.personalService.findEmployeeOne(employee.id);
      if (personal) {
        await this.personalService.remove(personal.id);
      }

      const bankInfo = await this.bankInfoService.findByEmployeeId(employee.id);
      if (bankInfo) {
        await this.bankInfoService.remove(employee.id);
      }

      const auditTrail = await this.auditTrailService.findByEmployee(employee.id);
      if (auditTrail) {
        await this.auditTrailService.remove(employee.id);
      }

      await this.leaveService.deleteLeavesByEmployeeId(employee.id); 
      await this.payrollService.deletePayrollsByEmployeeId(employee.id);
      await this.employeeRepository.delete(id);
      await this.userService.remove(employee.userId);
    }
  }

  async findByOrganization(id: number): Promise<Employee[]> {
    try {
      return await this.employeeRepository.find({
        where: {
          orgId: id
        },
        relations: ['organization'],
      });
    } catch (error) {
      console.error('Error finding employees by organization:', error);
      throw new Error('Failed to retrieve employees by organization.');
    }
  }

  async findReportingManager(id: number): Promise<Employee[]> {
    try {
      const employeeData = await this.employeeRepository.findOne({
        where: {
          id: id
        },
      });
      if (employeeData.reportTo !== null) {
        return await this.employeeRepository.find({
          where: {
            id: employeeData.reportTo
          },
        });
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error finding employees by organization:', error);
      throw new Error('Failed to retrieve employees by organization.');
    }
  }

  async findSubordinates(id: number): Promise<Employee[]> {
    try {
      return await this.employeeRepository.find({
        where: {
          reportTo: id
        },
      });
    } catch (error) {
      console.error('Error finding employees by organization:', error);
      throw new Error('Failed to retrieve employees by organization.');
    }
  }

  async findOnlyManagers(): Promise<Employee[]> {
    try {
      return await this.employeeRepository.find({
        where: [
          { designation: "Manager" },
          { designation: "Lead" },
          { designation: "Senior" },
          { designation: "Director" },
          { designation: "VP" }
        ]
      });
    } catch (error) {
      console.log('Error finding managers:', error);
      if (error.detail) {
        console.error('Database error details:', error.detail);
      }
      throw new Error('Failed to retrieve managers.');
    }
  }

  async findAllWithLeaves(): Promise<any> {
    try {
      const query = this.employeeRepository
        .createQueryBuilder('employee')
        .leftJoin('employee.leaves', 'leaves')
        .select([
          'employee.id AS "id"',
          'employee.employee_id AS "employeeId"',
          'employee.first_name AS "firstName"',
          'employee.middle_name AS "midName"',
          'employee.last_name AS "lastName"',
          'employee.email AS "email"',
          'employee.status AS "status"',
          'employee.designation AS "designation"',
          'employee.avatar AS "avatar"',
          'employee.phone AS "phone"',
          'employee.address AS "address"',
          'employee.job_title AS "jobTitle"',
          'employee.gender AS "gender"',
          'employee.department AS "department"',
          'employee.is_probation AS "isProbation"',
          'employee.confirmation_date AS "confirmationDate"',
          'employee.employment_type AS "employmentType"',
          'employee.joining_date AS "joiningDate"',
          'employee.dob AS "dob"',
          'employee.ctc AS "ctc"',
          'employee.org_id AS "orgId"',
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
        .groupBy('employee.id');

      const employees = await query.getRawMany();

      return employees.map(employee => ({
        id: employee.id,
        employeeId: employee.employeeId,
        firstName: employee.firstName,
        midName: employee.midName,
        lastName: employee.lastName,
        email: employee.email,
        status: employee.status,
        designation: employee.designation,
        avatar: employee.avatar,
        phone: employee.phone,
        address: employee.address,
        jobTitle: employee.jobTitle,
        gender: employee.gender,
        department: employee.department,
        isProbation: employee.isProbation,
        confirmaionDate: employee.confirmationDate,
        employmentType: employee.employmentType,
        joiningDate: employee.joiningDate,
        dob: employee.dob,
        ctc: employee.ctc,
        orgId: employee.orgId,
        createdAt: employee.createdAt,
        updatedAt: employee.updatedAt,
        pendingLeaves: parseInt(employee.pendingLeaves, 10) || 0,
        approvedLeaves: parseInt(employee.approvedLeaves, 10) || 0,
      }));
    } catch (error) {
      console.error('Error finding Employees:', error);
      if (error.detail) {
        console.error('Database error details:', error.detail);
      }
      throw new Error('Failed to retrieve employees with leaves.');
    }
  }

  async findLastEmployee(): Promise<Employee | null> {
    try {
      const lastEmployee = await this.employeeRepository
        .createQueryBuilder('employee')
        .orderBy('employee.employeeId', 'DESC')
        .getOne();

      return lastEmployee || null;
    } catch (error) {
      console.error('Error fetching last employee:', error);
      throw new Error('Failed to fetch last employee');
    }
  }

   async markAsInactive(
    id: number,
    reason: InactivationReason,
    remarks?: string,
    userId?: number,
    inactivationDate?: string,
    status?: EmployeeStatus,
  ): Promise<Employee> {
    try {
      const employee = await this.findOne(id);
      if (!employee) {
        throw new BadRequestException('Employee not found');
      }

      // AC2: Validate reason is provided
      if (!reason) {
        throw new BadRequestException('Reason for inactivation is required');
      }

      // AC3: If reason is OTHER, remarks is mandatory
      if (reason === InactivationReason.OTHER && !remarks) {
        throw new BadRequestException(
          'Remarks are required when reason is "Other"',
        );
      }

      const previousStatus = employee.status;
    

      // Update employee status and inactivation details
    

      await this.employeeRepository.update(id, {
        status: status,
        inactivationReason: reason,
        inactivationRemarks: remarks || null,
        inactivationDate: new Date(inactivationDate),
      });

      const updatedEmployee = await this.findOne(id);

      // AC6: Log in audit trail
      if (userId) {
        const reasonText =
          reason === InactivationReason.OTHER
            ? `${reason}: ${remarks}`
            : reason;

        await this.auditTrailService.logEmployeeStatusChange(
          updatedEmployee,
          previousStatus,
          EmployeeStatus.INACTIVE,
          reasonText,
          userId,
        );
      }

      return updatedEmployee;
    } catch (error) {
      console.error('Error marking employee as inactive:', error);
      throw error;
    }
  }

  

  async markAsActive(
    id: number,
    userId: number,
    request?: any,
  ): Promise<Employee> {
    try {
      const employee = await this.findOne(id);
      if (!employee) {
        throw new BadRequestException('Employee not found');
      }

      const previousStatus = employee.status;

      // Update status
      await this.employeeRepository.update(id, {
        status: EmployeeStatus.ACTIVE,
        inactivationReason: null,
        inactivationRemarks: null,
        inactivationDate: null,
      });

      const updatedEmployee = await this.findOne(id);

      // Log in audit trail
      if (userId) {
        await this.auditTrailService.logEmployeeStatusChange(
          updatedEmployee,
          previousStatus,
          EmployeeStatus.ACTIVE,
          'Employee reactivated',
          userId,
        );
      }

      return updatedEmployee;
    } catch (error) {
      console.error('Error marking employee as active:', error);
      throw error;
    }
  }

    async checkExistence(checkExistenceDto: CheckExistenceDto) {
    const { email, phone } = checkExistenceDto;

    // Validate that at least one field is provided
    if (!email && !phone) {
      throw new BadRequestException('Either email or phone must be provided');
    }

    const result = {
      email: {
        exists: false,
        existsIn: [] as string[],
      },
      phone: {
        exists: false,
        existsIn: [] as string[],
      },
    };

    // Check email existence
    if (email) {
      // Check in User entity
      const userExists = await this.userService.findByEmail(email);

      // Check in Employee entity
      const employeeExists = await this.employeeRepository.findOne({
        where: { email },
      });

      if (userExists) {
        result.email.exists = true;
        result.email.existsIn.push('users');
      }

      if (employeeExists) {
        result.email.exists = true;
        result.email.existsIn.push('employees');
      }
    }

    // Check phone existence
    if (phone) {
      const employeeWithPhone = await this.employeeRepository.findOne({
        where: { phone },
      });

      if (employeeWithPhone) {
        result.phone.exists = true;
        result.phone.existsIn.push('employees');
      }
    }

    return {
      success: true,
      data: result,
    };
  }





  async sendWelcomeEmail(employee: Employee): Promise<void> {
    try {
      const subject = `Welcome to Our Company - Account Created`;

      const fs = require('fs');
      const imageBuffer = fs.readFileSync('./uploads/avatars/Auxaitech-01.png');

      const base64String = imageBuffer.toString('base64');
      const mimeType = 'png'; // or detect from file extension
      const imgSrc = `data:image/${mimeType};base64,${base64String}`;

      // Plain text version
      const text = `
Dear ${employee.firstName} ${employee.lastName},

Welcome to our organization! Your employee account has been successfully created in our HR Management System.

Employee Account Details:
Employee ID: ${employee.employeeId}
Name: ${employee.firstName} ${employee.midName || ''} ${employee.lastName}
Email: ${employee.email}
Department: ${employee.department || 'Not specified'}
Job Title: ${employee.jobTitle || 'Not specified'}
Joining Date: ${new Date(employee.joiningDate).toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}

System Login Credentials:
Username: ${employee.email}
Password: "First_Name@12345"

IMPORTANT: Please change your password immediately upon first login for security purposes.

If you have any questions or need assistance, please contact our HR department.

This notification was sent automatically by the HR Management System.
      `;

      // HTML version with better formatting
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="display: flex; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px;">
           <img src='${imgSrc}' alt="Company Logo" style="height: 40px; margin-right: 20px;">  
          <h2 style="color: #333; margin: 0;">Welcome to Our Company!</h2>
          </div>

          <div style="margin: 20px 0;">
            <p style="font-size: 16px; color: #333;">Dear ${employee.firstName} ${employee.lastName},</p>
            <p style="font-size: 14px; color: #555; line-height: 1.6;">
              Welcome to our organization! Your employee account has been successfully created in our HR Management System. We're excited to have you on board.
            </p>
          </div>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px;">Employee Account Details:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #555;"><strong>Employee ID:</strong></td>
                <td style="padding: 8px 0; color: #333;">${employee.employeeId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #555;"><strong>Name:</strong></td>
                <td style="padding: 8px 0; color: #333;">${employee.firstName} ${employee.midName || ''} ${employee.lastName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #555;"><strong>Email:</strong></td>
                <td style="padding: 8px 0; color: #333;">${employee.email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #555;"><strong>Department:</strong></td>
                <td style="padding: 8px 0; color: #333;">${employee.department || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #555;"><strong>Job Title:</strong></td>
                <td style="padding: 8px 0; color: #333;">${employee.jobTitle || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #555;"><strong>Joining Date:</strong></td>
                <td style="padding: 8px 0; color: #333;">${new Date(employee.joiningDate).toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0; margin-bottom: 10px;">System Login Credentials:</h3>
            <p style="margin: 8px 0; color: #856404;"><strong>Username:</strong> ${employee.email}</p>
            <p style="margin: 8px 0; color: #856404;"><strong>Password:</strong> <code style="background-color: #fff; padding: 2px 6px; border-radius: 3px; font-family: monospace;">"First_Name@12345"</code></p>
            <p style="margin: 8px 0; color: #856404; font-weight: bold;">⚠️ IMPORTANT: Please change your password immediately upon first login for security purposes.</p>
          </div>

          <div style="background-color: #e7f3ff; padding: 15px; border-radius: 5px; border-left: 4px solid #2196F3; margin: 20px 0;">
            <p style="margin: 0; color: #1565c0;">If you have any questions or need assistance with the system, please don't hesitate to contact our HR department.</p>
          </div>

          <div style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; color: #666; margin-top: 20px; text-align: center;">
            <p style="margin-bottom: 10px;">This is an automated notification from the HR Management System.</p>
            <img src='${imgSrc}' alt="Company Logo" style="height: 30px;">
 
           </div>
        </div>
      `;

      // Send the email
      await this.emailService.sendMail(
        employee.email,
        subject,
        text,
        html,
        {
          replyTo: process.env.HR_EMAIL || 'hr@company.com',
        }
      );

      console.log(`Welcome email sent to ${employee.email} for employee ${employee.employeeId}`);
    } catch (emailError) {
      console.error(`Failed to send welcome email: ${emailError.message}`, emailError.stack);
      // Don't throw error - we don't want email failure to prevent employee creation
    }
  }
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async handleDailyInactivationCheck() {
  console.log("Inactivation check started at:", new Date().toString());

  try {
    // Let PostgreSQL handle the date comparison (no timezone issues)
    const employeesToUpdate = await this.employeeRepository
      .createQueryBuilder("employee")
      .where("employee.status = :status", { status: EmployeeStatus.PENDING_INACTIVE })
      .andWhere("DATE(employee.inactivationDate) <= CURRENT_DATE")
      .getMany();

    console.log(`Found ${employeesToUpdate.length} employees to inactivate`);

    for (const employee of employeesToUpdate) {
      await this.employeeRepository.update(employee.id, {
        status: EmployeeStatus.INACTIVE,
      });
      console.log(`Employee ${employee.id} updated to INACTIVE`);
    }
    
    console.log("Inactivation check completed");
  } catch (error) {
    console.error("Error in inactivation check:", error);
  }
}
}