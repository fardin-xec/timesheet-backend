// src/entities/bank-info.entity.ts
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from './employees.entity';

@Entity('bank_info')
export class BankInfo {
  @PrimaryGeneratedColumn({ name: 'bank_id' })
  bankId: number;

  @Column({ name: 'employee_id', nullable: true })
  employeeId: number;

  @Column({ name: 'bank_name', length: 100 })
  bankName: string;

  @Column({ name: 'account_holder_name', length: 100 })
  accountHolderName: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ name: 'branch_name', length: 100, nullable: true })
  branchName: string;

  @Column({ name: 'ifsc_code', length: 20 })
  ifscCode: string;

  @Column({ name: 'account_no', length: 50 })
  accountNo: string;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Employee, employee => employee.bankAccounts)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;
}