import { Controller, Get, Param, Post, Body, Put, Delete, UseGuards, HttpStatus } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { Employee } from '../entities/employees.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResponseDto } from '../dto/response.dto';
import { UsersService } from 'src/user/user.service';
import { User, UserRole } from '../entities/users.entity';
import { BankInfoService } from 'src/bank-info/bank-info.service';

@Controller('employees')
export class EmployeeController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly UsersService: UsersService,
    private readonly bankInfoService: BankInfoService,


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
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() employeeData: Partial<Employee>): Promise<ResponseDto<Employee>> {
    try {

      // Step 1: Prepare user data
      const password = employeeData.firstName+"@12345"; // Hash the password
      const userData = {
        username: `${employeeData.firstName} ${employeeData.lastName}`,
        email: employeeData.email,
        password: password,
        role: UserRole.USER,
        orgId: employeeData.orgId,
      };

      // Step 2: Create the user
      const user = await this.UsersService.create(userData);

      // Step 3: Create the employee with the user information
      const data = await this.employeeService.create({
        ...employeeData,
        userId: user.id, // Assuming the user ID is needed to link the employee to the user
      });

      if(data.id){
        employeeData.bankAccounts.employeeId=data.id
        const bank=this.bankInfoService.create(employeeData.bankAccounts)
        
      }
    
      return new ResponseDto(HttpStatus.CREATED, 'Employee created successfully', data);
    } catch (error) {
      // Handle errors appropriately
      console.error('Error creating employee:', error);
      return new ResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to create employee', null);
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
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ResponseDto<void>> {
    await this.employeeService.remove(+id);
    return new ResponseDto(HttpStatus.OK, 'Employee deleted successfully');
  }

  @UseGuards(JwtAuthGuard)
  @Put('/user/:id')
  async updateUser(@Param('id') id: string, @Body() userData: Partial<User>): Promise<ResponseDto<User>> {
    const data = await this.UsersService.update(+id, userData);
    if (!data) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'User not found');
    }
    return new ResponseDto(HttpStatus.OK, 'User updated successfully', data);
  }

}
