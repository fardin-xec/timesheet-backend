import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Personal } from '../entities/personal.entity';
import { PersonalService } from './personal.service';
import { PersonalController } from './personal.controller';
import { BankInfo } from 'src/entities/bank-info.entity';
import { Document } from 'src/entities/document.entity';
import { Employee } from 'src/entities/employees.entity';
import { LeaveRule } from 'src/entities/leave-rule.entity';
import { EmployeeLeaveRule } from 'src/entities/employee-leave-rule.entity';
import { LeaveManagementModule } from 'src/LeaveManagementModule/leave.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Personal,
      Document,
      BankInfo,
      Employee,
      LeaveRule,           // Add this back
      EmployeeLeaveRule    // Add this back
    ]),
    LeaveManagementModule, // Keep this for LeaveService if needed
  ],
  controllers: [PersonalController],
  providers: [PersonalService],
  exports: [PersonalService],
})
export class PersonalModule {}