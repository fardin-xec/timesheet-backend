import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalanceCronService } from './leave-balance.cron';
import { LeaveBalanceCronController } from './eave-balance-cron.controller';
import { LeaveBalances } from '../entities/leave-balance.entity';
import { Employee } from '../entities/employees.entity';
import { LeaveRule } from '../entities/leave-rule.entity';
import { EmployeeLeaveRule } from '../entities/employee-leave-rule.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      LeaveBalances,
      Employee,
      LeaveRule,
      EmployeeLeaveRule,
    ]),
  ],
  controllers: [LeaveBalanceCronController],
  providers: [LeaveBalanceCronService],
  exports: [LeaveBalanceCronService],
})
export class CronModule {}

