import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { LeaveRuleService } from './leave-rule.service';
import { Leave } from '../entities/leave.entity';
import { LeaveRule } from '../entities/leave-rule.entity';
import { LeaveBalances } from '../entities/leave-balance.entity';
import { Employee } from '../entities/employees.entity';
import { Organization } from '../entities/organizations.entity';
import { EmployeeLeaveRule } from '../entities/employee-leave-rule.entity';
import { DocumentsModule } from 'src/documents/documents.module';
import { EmailModule } from 'src/email/email.module';
import { LeaveValidationService } from './leave-validation.service';
import { Holiday } from 'src/entities/holiday.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Leave,
      LeaveRule,
      LeaveBalances,
      Employee,
      Organization,
      EmployeeLeaveRule,
      Holiday,
    ]),
    DocumentsModule,
    EmailModule,
  ],
  controllers: [LeaveController],
  providers: [LeaveService, LeaveRuleService,LeaveValidationService],
  exports: [LeaveService, LeaveRuleService,LeaveValidationService],
})
export class LeaveManagementModule {}