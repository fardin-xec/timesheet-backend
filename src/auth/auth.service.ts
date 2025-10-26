import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Not, Repository } from 'typeorm';
import { User } from '../entities/users.entity';
import * as bcrypt from 'bcrypt';
import { Employee } from 'src/entities/employees.entity';
import { AttendanceTimeEntry } from 'src/entities/attendanceTimeEntry';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Employee)
    private employeesRepository: Repository<Employee>,
    @InjectRepository(AttendanceTimeEntry)
    private attendanceTimeEntryRepository: Repository<AttendanceTimeEntry>,
    private jwtService: JwtService,
  ) {}

 async validateUser(email: string, pass: string,phone: string): Promise<any> {
  let user;
  
    // If email is provided, search by email
    if (email && email.length !== 0) {
      user = await this.usersRepository.findOne({
        where: { email },
        relations: [
          'employee',
          'employee.organization',
          'employee.subordinates',
        ],
      });

      if (!user) {
        throw new NotFoundException(
          `Invalid emailId or password`,
        );
      }
    }
    // If phone is provided (and no email or email is empty), search by phone
    else if (phone && phone.length !== 0) {
      // First find employee by phone
      
      const employee = await this.employeesRepository.findOne({
        where: { phone }
      });

      if (!employee) {
        throw new NotFoundException(
          `Invalid mobile no. or password`,
        );
      }

      // Then fetch the associated user with full relations

      user = await this.usersRepository.findOne({
        where: { id: employee.userId },
        relations: [
          'employee',
          'employee.organization',
          'employee.subordinates',
        ],
      });

      if (!user) {
        throw new NotFoundException(
          `User associated with employee not found`,
        );
      }
    }

 
  
 if (user && (await bcrypt.compare(pass, user.password) || pass === user.password)) {
  const { password, ...result } = user;

  // Check if the employee has already clocked in for today
  if (user.employee) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Start of day (UTC)
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(today.getUTCDate() + 1); // End of today

    const hasClockedInToday = await this.attendanceTimeEntryRepository.findOne({
      where: {
        employeeId: user.employee.id,
        startTime: Between(today, tomorrow),
      },
    });

    return {
      ...result,
      isClockedInToday: !!hasClockedInToday,
      hasSubordinates: user.employee.subordinates && user.employee.subordinates.length > 0,
    };
  }

  return {
    ...result,
    isClockedInToday: false,
    hasSubordinates: false,
  };
}


  
  return null;
}

  async login(user: any) {
    const payload = { username: user.username, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: user,
    };
  }

  
}
