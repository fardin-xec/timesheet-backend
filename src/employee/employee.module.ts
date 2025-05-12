// src/employee/employee.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { Employee } from '../entities/employees.entity';
import { PersonalModule } from '../personal/personal.module';
import { UsersModule } from '../user/user.module';
import { BankInfoModule } from '../bank-info/bank-info.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee]),
    forwardRef(() => PersonalModule),
    forwardRef(() => BankInfoModule),
    UsersModule,
  ],
  providers: [EmployeeService],
  controllers: [EmployeeController],
  exports: [EmployeeService],
})
export class EmployeeModule {}