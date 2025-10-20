import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationModule } from './organisation/organization.module';
import { EmployeeModule } from './employee/employee.module';
// import { LeaveModule } from './leave/leave.module';
// import { AttendanceModule } from './attendance/attendance.module';
// import { RuleModule } from './rule/rule.module';
import { DropdownModule } from './dropdown/dropdown.module';
import { BankInfoModule } from './bank-info/bank-info.module';
import { AuthModule } from './auth/auth.module';
import { Organization } from './entities/organizations.entity';
import { Employee } from './entities/employees.entity';
import { User } from './entities/users.entity';
import { Leave } from './entities/leave.entity';
// import { Attendance } from './entities/attendance.entity';
import { Rule } from './entities/rules.entity';
import { DropdownType } from './entities/dropdown-types.entity';
import { DropdownValue } from './entities/dropdown-values.entity';
import { BankInfo } from './entities/bank-info.entity';
import { Personal } from './entities/personal.entity';
import { PersonalModule } from './personal/personal.module';
import { EmployeeLeaveRule } from './entities/employee-leave-rule.entity';
import { LeaveBalances } from './entities/leave-balance.entity';
import { LeaveRule } from './entities/leave-rule.entity';
import { LeaveManagementModule } from './LeaveManagementModule/leave.module';
import { AttendanceModule } from './attendance/attendance.module';
import { Attendance } from './entities/attendances.entity';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { PayrollModule } from './payroll/payroll.module';
import { Payroll } from './entities/payrolls.entity';
import { Payslip } from './entities/payslips.entity';
import { TaxRegime } from './entities/tax-regime.entity';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { DocumentsModule } from './documents/documents.module';
import { AuditTrail } from './entities/audit-trail.entity';
import { AuditTrailModule } from './audit-trail/audit-trail.module';
import { Document } from './entities/document.entity';

@Module({
  imports: [
    
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',

    }),

    
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [
        Organization,
        Employee,
        User,
        Personal, // Make sure both are included
        Rule,
        DropdownType,
        DropdownValue,
        BankInfo,
        Leave,
        EmployeeLeaveRule,
        LeaveBalances,
        LeaveRule,
        Attendance,
        Payroll,
        Payslip,
        TaxRegime,
        AuditTrail,
        Document,
      ],
      synchronize: true,
    }),
    WinstonModule.forRoot({
      transports: [
        new winston.transports.File({ filename: 'logs/cron.log' }),
      ],
    }),
    OrganizationModule,
    EmployeeModule,
    DropdownModule,
    BankInfoModule,
    AuthModule,
    PersonalModule,
    LeaveManagementModule,
    AttendanceModule,
    PayrollModule,
    EmailModule,
    HealthModule,
    DocumentsModule,
    AuditTrailModule,
  ],
})
export class AppModule {}
