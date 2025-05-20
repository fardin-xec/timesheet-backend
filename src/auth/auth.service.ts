import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from '../entities/users.entity';
import * as bcrypt from 'bcrypt';
import { Attendance } from '../entities/attendances.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    
    const user = await this.usersRepository.findOne({ where: { email },  relations: ['employee', 'employee.organization']}); 
    if (user && (await bcrypt.compare(pass, user.password) || pass === user.password)) {
      const { password, ...result } = user;
      
      // Check if the employee has already clocked in for today
      if (user.employee) {
        const today = new Date(); // Current date (should be April 21, 2025)
        today.setUTCHours(0, 0, 0, 0); // Use UTC to avoid timezone offset
        const todayString = today.toISOString().split('T')[0];
        const attendanceDateObj = new Date(todayString); 
        
        const attendance = await this.attendanceRepository.findOne({
          where: {
            employeeId: user.employee.id,
            attendanceDate: attendanceDateObj,
            checkInTime: Not(IsNull()) // Check if checkInTime is not null
          }
        });
        
        return {
          ...result,
          isClockedInToday: !!attendance // Boolean indicating if checked in
        };
      }
      
      return {
        ...result,
        isClockedInToday: false
      };
    }
    
    return null;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.userId };
    return {
      access_token: this.jwtService.sign(payload),
      user: user,
    };
  }

  
}
