import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToOne } from 'typeorm';
import { Payroll } from './payrolls.entity';
import { Employee } from '../entities/employees.entity';

@Entity('payslips')
export class Payslip {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'payroll_id' })
  payrollId: number;

  @OneToOne(() => Payroll, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payroll_id' })
  payroll: Payroll;

  @Column({ name: 'employee_id' })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

 

  @Column({ type: 'date' })
  generatedDate: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pdfUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}