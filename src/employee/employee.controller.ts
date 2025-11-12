import { Controller, Get, Param, Post, Body, Put, Delete, UseGuards, HttpStatus,Request, HttpCode, BadRequestException } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { Employee, EmployeeStatus, InactivationReason } from '../entities/employees.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResponseDto } from '../dto/response.dto';
import { UsersService } from 'src/user/user.service';
import { BankInfoService } from 'src/bank-info/bank-info.service';
import { CheckExistenceDto, CreateEmployeeDto } from './dto/create-employee.dto';
import { JwtStrategy } from 'src/auth/jwt.strategy';
import { JwtSecretRequestType } from '@nestjs/jwt';
import { ApiOperation } from '@nestjs/swagger';
import { PersonalService } from 'src/personal/personal.service';
import { UserRole } from 'src/entities/users.entity';

class passwordUpdateDto {
  oldPassword: string;
  newPassword: string;
}
class UpdateEmployeeStatusDto {
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING_INACTIVE';
  reason?: InactivationReason;
  remarks?: string;
  inactivationDate?: string;
}

@Controller('employees')
export class EmployeeController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly UsersService: UsersService,
    private readonly bankInfoService: BankInfoService,
    private readonly personalService: PersonalService,


  ) 

    {}

    @UseGuards(JwtAuthGuard)
    @Get('/managers')
    async findOnlyManagers(): Promise<ResponseDto<Employee[]>> {
      try {
  
        const data = await this.employeeService.findOnlyManagers();
        
        // Better null/empty array handling
        if (!data || data.length === 0) {
          return new ResponseDto(HttpStatus.NOT_FOUND, 'No managers found', []);
        }
        
        return new ResponseDto(HttpStatus.OK, 'Managers retrieved successfully', data);
      } catch (error) {
        console.error('Controller error:', error);
        return new ResponseDto(
          HttpStatus.INTERNAL_SERVER_ERROR, 
          'Failed to retrieve managers',
          null
        );
      }
    }
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(): Promise<ResponseDto<Employee[]>> {
    const data = await this.employeeService.findAll();
    return new ResponseDto(HttpStatus.OK, 'Employees retrieved successfully', data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/leaves')
  async findAllWithLeaves(): Promise<ResponseDto<any>> {
    const data = await this.employeeService.findAllWithLeaves();
    return new ResponseDto(HttpStatus.OK, 'Employees retrieved successfully', data);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ResponseDto<Employee>> {
    const data = await this.employeeService.findOne(+id);
    if (!data) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Employee not found');
    }
    return new ResponseDto(HttpStatus.OK, 'Employee retrieved successfully', data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/organization/:id')
  async findbyOrganization(@Param('id') id: string): Promise<ResponseDto<Employee[]>> {
    const data = await this.employeeService.findByOrganization(+id);
    if (!data) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Employee not found');
    }
    return new ResponseDto(HttpStatus.OK, 'Employee retrieved successfully', data);
  }
  @UseGuards(JwtAuthGuard)
  @Get(':id/reprotingManager')
  async findbyReportingManager(@Param('id') id: string): Promise<ResponseDto<Employee[]>> {
    const data = await this.employeeService.findReportingManager(+id);
    if (!data) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Employee not found');
    }
    return new ResponseDto(HttpStatus.OK, 'Employee retrieved successfully', data);
  }
  subordinates

  @UseGuards(JwtAuthGuard)
  @Get(':id/subordinates')
  async findSubordinates(@Param('id') id: string): Promise<ResponseDto<Employee[]>> {
    const data = await this.employeeService.findSubordinates(+id);
    if (!data) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Employee not found');
    }
    return new ResponseDto(HttpStatus.OK, 'Employee retrieved successfully', data);
  }


  // @UseGuards(JwtAuthGuard)
  // // Access the request object
  // @Post()
  // async create(@Body() createEmployeeDto: Partial<CreateEmployeeDto>, @Request() req: any): Promise<ResponseDto<Employee>> {
  //   try {
  //        const jwtPayload = req.user; // This contains the decoded token data


    
   

  //     // Step 1: Prepare user data
  //     const password = createEmployeeDto.firstName+"@12345"; // Hash the password
  //     let mappedRole = this.employeeService.mapRoleToUserRole(createEmployeeDto.role);
  //     if(createEmployeeDto.designation!=="Junior"&&createEmployeeDto.designation!=="C-Level"&&createEmployeeDto.designation!=="Mid-level"&&mappedRole===UserRole.USER){
  //            mappedRole=UserRole.MANAGER;
  //     }
  //     const userData = {
  //       username: `${createEmployeeDto.firstName} ${createEmployeeDto.lastName}`,
  //       email: createEmployeeDto.email,
  //       password: password,
  //       role: mappedRole,
  //       orgId: createEmployeeDto.orgId,
  //     };

  //     // Step 2: Create the user
  //     const user = await this.UsersService.create(userData);
  //     //update employeeId auto generate AT-00XX

  //      // Step 3: Generate employee ID in format AT-XX00
  //   const lastEmployee = await this.employeeService.findLastEmployee(); // Assume this method gets the last employee
  //   let newEmployeeId = 'AT-0000';
  //   if (lastEmployee && lastEmployee.employeeId) {
  //     const lastIdNumber = parseInt(lastEmployee.employeeId.split('-')[1], 10);
  //     const newIdNumber = (lastIdNumber + 1).toString().padStart(4, '0');
  //     newEmployeeId = `AT-${newIdNumber}`;
  //   }
  //   console.log(newEmployeeId)

  //    const employeeData: Partial<Employee> = {
  //       employeeId: newEmployeeId,
  //       firstName: createEmployeeDto.firstName,
  //       midName: createEmployeeDto.midName,
  //       lastName: createEmployeeDto.lastName,
  //       email: createEmployeeDto.email,
  //       phone: createEmployeeDto.phone,
  //       status: createEmployeeDto.status,
  //       dob: createEmployeeDto.dob ? new Date(createEmployeeDto.dob) : null,
  //       gender: createEmployeeDto.gender,
  //       department: createEmployeeDto.department,
  //       jobTitle: createEmployeeDto.jobTitle,
  //       designation: createEmployeeDto.designation,
  //       address: createEmployeeDto.address,
  //       employmentType: createEmployeeDto.employmentType,
  //       joiningDate: createEmployeeDto.joiningDate
  //         ? new Date(createEmployeeDto.joiningDate)
  //         : new Date(),
  //       isProbation: createEmployeeDto.isProbation,
  //       confirmationDate: createEmployeeDto.confirmationDate
  //         ? new Date(createEmployeeDto.confirmationDate)
  //         : null,
  //       ctc: createEmployeeDto.ctc ? parseFloat(createEmployeeDto.ctc) : null,
  //       currency: createEmployeeDto.currency || 'USD',
  //       bio: createEmployeeDto.bio,
  //       userId: user.id,
  //       orgId: createEmployeeDto.orgId,
  //       qid: createEmployeeDto.qid,
  //       qidExpiration:createEmployeeDto.qidExpirationDate ? new Date(createEmployeeDto.qidExpirationDate): new Date(),
  //       passportNumber:createEmployeeDto.passportNumber,
  //       passportExpiration:createEmployeeDto.passportValidTill ? new Date(createEmployeeDto.passportValidTill): new Date(),
  //       reportTo: createEmployeeDto.reportTo,
  //       workLocation: createEmployeeDto.workLocation,
  //     };


  //   //   // Step 4: Create the employee with the user information
  //     const data = await this.employeeService.create({
  //       ...employeeData,
  //       userId: user.id, // Assuming the user ID is needed to link the employee to the user
  //       employeeId: newEmployeeId, // Add auto-generated employeeId

  //     },jwtPayload.userId);

  //     // await this.personalService.createEmptyPersonal(data.id);


      
  //       await this.bankInfoService.create({
  //         employeeId: data.id,
  //         bankName: createEmployeeDto.bankName,
  //         accountHolderName: createEmployeeDto.accountHolderName,
  //         accountNo: createEmployeeDto.accountNumber,
  //         ifscCode: createEmployeeDto.ifscCode,
  //         branchName: createEmployeeDto.branchName,
  //         city: createEmployeeDto.city,
  //         swiftCode: createEmployeeDto.swiftCode,
  //         ibanNo: createEmployeeDto.ibanNo,
  //       });
      

  //     await this.employeeService.sendWelcomeEmail(data);
    
  //     return new ResponseDto(HttpStatus.CREATED, 'Employee created successfully');
  //   } catch (error) {
  //     // Handle errors appropriately
  //     console.error('Error creating employee:', error);
  //     return new ResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to create employee', null);
  //   }
  // }
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Create new employee' })
  async create(
    @Body() createEmployeeDto: Partial<CreateEmployeeDto>, 
    @Request() req: any
  ): Promise<ResponseDto<any>> {
    try {
      const jwtPayload = req.user;

      // Validate required fields
      this.validateEmployeeData(createEmployeeDto);

      // Prepare user data
      const password = `${createEmployeeDto.firstName}@12345`;
      let mappedRole = this.employeeService.mapRoleToUserRole(createEmployeeDto.role);
      
      // Auto-assign manager role for certain designations
      if (
        createEmployeeDto.designation !== "Junior" &&
        createEmployeeDto.designation !== "C-Level" &&
        createEmployeeDto.designation !== "Mid-level" &&
        mappedRole === UserRole.USER
      ) {
        mappedRole = UserRole.MANAGER;
      }

      const userData = {
        username: `${createEmployeeDto.firstName} ${createEmployeeDto.lastName}`,
        email: createEmployeeDto.email,
        password: password,
        role: mappedRole,
        orgId: createEmployeeDto.orgId,
      };

      // Prepare employee data
      const employeeData: Partial<Employee> = {
        firstName: createEmployeeDto.firstName,
        midName: createEmployeeDto.midName,
        lastName: createEmployeeDto.lastName,
        email: createEmployeeDto.email,
        phone: createEmployeeDto.phone,
        status: createEmployeeDto.status || EmployeeStatus.ACTIVE,
        dob: createEmployeeDto.dob ? new Date(createEmployeeDto.dob) : null,
        gender: createEmployeeDto.gender,
        department: createEmployeeDto.department,
        jobTitle: createEmployeeDto.jobTitle,
        designation: createEmployeeDto.designation,
        address: createEmployeeDto.address,
        employmentType: createEmployeeDto.employmentType,
        joiningDate: createEmployeeDto.joiningDate
          ? new Date(createEmployeeDto.joiningDate)
          : new Date(),
        isProbation: createEmployeeDto.isProbation ?? false,
        confirmationDate: createEmployeeDto.confirmationDate
          ? new Date(createEmployeeDto.confirmationDate)
          : null,
        ctc: createEmployeeDto.ctc ? parseFloat(createEmployeeDto.ctc) : null,
        currency: createEmployeeDto.currency || 'USD',
        bio: createEmployeeDto.bio,
        orgId: createEmployeeDto.orgId,
        qid: createEmployeeDto.qid,
        qidExpiration: createEmployeeDto.qidExpirationDate 
          ? new Date(createEmployeeDto.qidExpirationDate) 
          : null,
        passportNumber: createEmployeeDto.passportNumber,
        passportExpiration: createEmployeeDto.passportValidTill 
          ? new Date(createEmployeeDto.passportValidTill) 
          : null,
        reportTo: createEmployeeDto.reportTo,
        workLocation: createEmployeeDto.workLocation,
      };

      // Prepare bank info data
      const bankInfoData = this.prepareBankInfoData(createEmployeeDto);

      // Create employee with transaction
      const result = await this.employeeService.createEmployeeWithTransaction(
        employeeData,
        userData,
        bankInfoData,
        jwtPayload.userId,
      );

      // Send welcome email asynchronously (non-blocking)
      this.employeeService.sendWelcomeEmail(result.employee);

      console.log(`Employee created successfully: ${result.employee.employeeId}`);

      return new ResponseDto(
        HttpStatus.CREATED, 
        'Employee created successfully',
        {
          employee: result.employee,
          message: 'Welcome email will be sent shortly',
        }
      );
    } catch (error) {
      console.error('Error creating employee:', error);
      
      if (error instanceof BadRequestException) {
        return new ResponseDto(
          HttpStatus.BAD_REQUEST,
          error.message,
          null
        );
      }
      
      return new ResponseDto(
        HttpStatus.INTERNAL_SERVER_ERROR, 
        'Failed to create employee. Please try again.',
        null
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() employeeData: Partial<Employee>): Promise<ResponseDto<Employee>> {
    const data = await this.employeeService.update(+id, employeeData);
    if (!data) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Employee not found');
    }
    return new ResponseDto(HttpStatus.OK, 'Employee updated successfully', data);
  }

   @UseGuards(JwtAuthGuard)
  @Put(':id/update-status')
  async updateEmployeeStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateEmployeeStatusDto,
    @Request() req: any,
  ): Promise<ResponseDto<Employee>> {
    try {
      const jwtPayload = req.user;
      let data: Employee;

      if (updateStatusDto.status === 'INACTIVE') {
        data = await this.employeeService.markAsInactive(
          +id,
          updateStatusDto.reason,
          updateStatusDto.remarks,
          jwtPayload.userId,
          updateStatusDto.inactivationDate,
          EmployeeStatus.INACTIVE,

        );
      } else if (updateStatusDto.status === 'PENDING_INACTIVE') {
         data = await this.employeeService.markAsInactive(
          +id,
          updateStatusDto.reason,
          updateStatusDto.remarks,
          jwtPayload.userId,
          updateStatusDto.inactivationDate,
          EmployeeStatus.PENDING_INACTIVE,

        );
      }else if (updateStatusDto.status === 'ACTIVE') {
        data = await this.employeeService.markAsActive(
          +id,
          jwtPayload.userId,
          req,
        );
      } else {
        return new ResponseDto(
          HttpStatus.BAD_REQUEST,
          'Invalid status. Must be either ACTIVE or INACTIVE',
          null,
        );
      }

      return new ResponseDto(
        HttpStatus.OK,
        `Employee status updated to ${updateStatusDto.status} successfully`,
        data,
      );
    } catch (error) {
      console.error('Error updating employee status:', error);
      return new ResponseDto(
        HttpStatus.BAD_REQUEST,
        error.message || 'Failed to update employee status',
        null,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ResponseDto<void>> {
    await this.employeeService.remove(+id);
    return new ResponseDto(HttpStatus.OK, 'Employee deleted successfully');
  }

  @UseGuards(JwtAuthGuard)
  @Put('/user/:id')
  async updateUser(@Param('id') id: string, @Body() userData:  passwordUpdateDto) {
    console.log(userData);
    
    const data = await this.UsersService.updatePassword(+id, userData.oldPassword,userData.newPassword);
    if (!data) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'User not found');
    }
    return new ResponseDto(HttpStatus.OK, 'User updated successfully', data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('check-existence')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Check if email or phone already exists',
    description: 'Validates if the provided email or phone number is already registered in the system'
  })
  async checkExistence(@Body() checkExistenceDto: CheckExistenceDto) {
    return this.employeeService.checkExistence(checkExistenceDto);
  }

  /**
   * Validate required employee data
   */
  private validateEmployeeData(data: Partial<CreateEmployeeDto>): void {
    const requiredFields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'orgId',
      'role',
    ];

    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Missing required fields: ${missingFields.join(', ')}`
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^[+]?[\d\s-()]+$/;
    if (!phoneRegex.test(data.phone)) {
      throw new BadRequestException('Invalid phone format');
    }
  }


  /**
   * Prepare bank info data from employee DTO
   */
  private prepareBankInfoData(createEmployeeDto: Partial<CreateEmployeeDto>): any {
    const hasBankInfo = 
      createEmployeeDto.bankName ||
      createEmployeeDto.accountHolderName ||
      createEmployeeDto.accountNumber ||
      createEmployeeDto.ifscCode ||
      createEmployeeDto.branchName ||
      createEmployeeDto.swiftCode ||
      createEmployeeDto.ibanNo;

    if (!hasBankInfo) {
      return null;
    }

    return {
      bankName: createEmployeeDto.bankName,
      accountHolderName: createEmployeeDto.accountHolderName,
      accountNo: createEmployeeDto.accountNumber,
      ifscCode: createEmployeeDto.ifscCode,
      branchName: createEmployeeDto.branchName,
      city: createEmployeeDto.city,
      swiftCode: createEmployeeDto.swiftCode,
      ibanNo: createEmployeeDto.ibanNo,
    };
  }
}


