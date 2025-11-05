import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Leave } from '../entities/leave.entity';
import { LeaveBalances } from '../entities/leave-balance.entity';
import { LeaveRule } from '../entities/leave-rule.entity';
import { EmployeeLeaveRule } from '../entities/employee-leave-rule.entity';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { Employee } from '../entities/employees.entity';
import { Organization } from '../entities/organizations.entity';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Leave,
      LeaveBalances,
      LeaveRule,
      EmployeeLeaveRule,
      Employee,
      Organization,
    ]),
    EmailModule,
  ],
  providers: [LeaveService],
  controllers: [LeaveController],
  exports: [
    LeaveService,
    TypeOrmModule, // Add this to export the repositories
  ], 
})
export class LeaveManagementModule {}