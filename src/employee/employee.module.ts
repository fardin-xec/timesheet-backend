// src/employee/employee.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { Employee } from '../entities/employees.entity';
import { PersonalModule } from '../personal/personal.module';
import { UsersModule } from '../user/user.module';
import { BankInfoModule } from '../bank-info/bank-info.module';
import { AuditTrailModule } from '../audit-trail/audit-trail.module'; // Import instead of providing
import { EmailModule } from '../email/email.module'; // Import instead of providing
import { PayrollModule } from 'src/payroll/payroll.module';
import { LeaveManagementModule } from 'src/LeaveManagementModule/leave.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Employee]),
    forwardRef(() => PersonalModule),
    forwardRef(() => BankInfoModule),
    UsersModule,
    AuditTrailModule, // Add this
    EmailModule, // Add this
    PayrollModule,
    LeaveManagementModule
  ],
  providers: [EmployeeService],
  controllers: [EmployeeController],
  exports: [EmployeeService],
})
export class EmployeeModule {}