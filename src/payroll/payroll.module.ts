import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { Payroll } from '../entities/payrolls.entity';
import { Payslip } from '../entities/payslips.entity';
import { Employee } from '../entities/employees.entity';
import { Attendance } from '../entities/attendances.entity';
import { Leave } from '../entities/leave.entity';
import { TaxRegime } from '../entities/tax-regime.entity';
import { PdfService } from './pdf.service';
import { Organization } from '../entities/organizations.entity';

@Module({
    imports: [
      ScheduleModule.forRoot(),
      TypeOrmModule.forFeature([Payroll, Payslip, Employee, Attendance, Leave, TaxRegime, Organization]),
    ],
    providers: [PayrollService, PdfService],
    controllers: [PayrollController],
     exports: [PayrollService],
  })
  export class PayrollModule {}