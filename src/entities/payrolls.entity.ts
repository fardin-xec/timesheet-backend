import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToOne } from 'typeorm';
import { Employee } from '../entities/employees.entity';
import { Organization } from '../entities/organizations.entity';
import { Payslip } from './payslips.entity';

export enum PayrollStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSED = 'processed',
}

@Entity('payrolls')
export class Payroll {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'employee_id' })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'org_id' })
  orgId: number;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;
  
  @Column({ type: 'date' })
  payrollMonth: Date;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  basicSalary: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  allowances: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  bonuses: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  deductions: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  taxDeductions: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  netSalary: number;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  workingDays: number;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  leaveDays: number;

  @Column({ type: 'enum', enum: PayrollStatus, default: PayrollStatus.PENDING })
  status: PayrollStatus;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @OneToOne(() => Payslip, payslip => payslip.payroll, { nullable: true })
  payslip: Payslip;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
