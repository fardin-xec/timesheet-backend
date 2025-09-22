import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../entities/employees.entity';
import { PersonalService } from 'src/personal/personal.service';
import { UsersService } from 'src/user/user.service';
import { BankInfoService } from 'src/bank-info/bank-info.service';
import { LeaveStatus } from 'src/entities/leave.entity';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee) private employeeRepository: Repository<Employee>,
    private personalService: PersonalService,
    private userService: UsersService,
    private bankInfoService: BankInfoService,
  ) {}

  findAll(): Promise<Employee[]> {
    return this.employeeRepository.find();
  }


  findOne(id: number): Promise<Employee> {
    return this.employeeRepository.findOneBy({ id });
  }

  async create(employeeData: Partial<Employee>): Promise<Employee> {
    const employee = this.employeeRepository.create(employeeData);
   
    return this.employeeRepository.save(employee);
  }

  async update(id: number, employeeData: Partial<Employee>): Promise<Employee> {
    await this.employeeRepository.update(id, employeeData);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const employee=await this.findOne(id);
    if(employee!==null){

      const personal=await this.personalService.findEmployeeOne(employee.id)
      if(personal){
        await this.personalService.remove(personal.id);
      }
      const bankInfo=await this.bankInfoService.findByEmployeeId(employee.id)
      
      if(bankInfo){
        await this.bankInfoService.remove(employee.id);
      }

      await this.employeeRepository.delete(id);
      await this.userService.remove(employee.userId);

    }
   

  }

  async findByOrganization(id: number): Promise<Employee[]> {
    try {
      // Find employees by organization ID using the correct where clause
      return await this.employeeRepository.find({
        where: {
          orgId: id
        },
        relations: ['organization'], // Include the 'org' relation if needed
      });
    } catch (error) {
      // Handle potential errors (e.g., database connection issues)
      console.error('Error finding employees by organization:', error);
      throw new Error('Failed to retrieve employees by organization.');
    }
  }
  async findReportingManager(id: number): Promise<Employee[]> {
    try {
      // Find employees by organization ID using the correct where clause
      const employeeData = await this.employeeRepository.findOne({
        where: {
          id: id
        },
      });
      if(employeeData.reportTo!==null){
        return await this.employeeRepository.find({
          where: {
            id: employeeData.reportTo
          },
        });    
      }else{
        return [];
      }
    } catch (error) {
      // Handle potential errors (e.g., database connection issues)
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
      // Handle potential errors (e.g., database connection issues)
      console.error('Error finding employees by organization:', error);
      throw new Error('Failed to retrieve employees by organization.');
    }
  }
  async findOnlyManagers(): Promise<Employee[]> {
    try {
      
      // Using proper TypeORM syntax for OR conditions
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
      // Add more detailed logging to help with debugging
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
          'employee.probation_period AS "probationPeriod"',
          'employee.employment_type AS "employmentType"',
          'employee.joining_date AS "joiningDate"',
          'employee.dob AS "dob"',
          'employee.ctc AS "ctc"',
          'employee.org_id AS "orgId"', // Fixed typo: ongId -> orgId
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
  
      // Log raw results for debugging
  
      // Map the results to ensure numbers for pendingLeaves and approvedLeaves
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
        probationPeriod: employee.probationPeriod,
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
  // Find the last employee based on employeeId
  async findLastEmployee(): Promise<Employee | null> {
    try {
      const lastEmployee = await this.employeeRepository
        .createQueryBuilder('employee')
        .orderBy('employee.employeeId', 'DESC') // Sort by employeeId in descending order
        .getOne(); // Get the first result (highest employeeId)

      return lastEmployee || null; // Return the employee or null if none exists
    } catch (error) {
      console.error('Error fetching last employee:', error);
      throw new Error('Failed to fetch last employee');
    }
  }

}
