// src/entities/employee-leave-rule.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from './employees.entity';
import { LeaveRule } from './leave-rule.entity';

@Entity('employee_leave_rules')
export class EmployeeLeaveRule {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ManyToOne(() => LeaveRule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rule_id' })
  rule: LeaveRule;

  @Column({ name: 'custom_max_allowed', type: 'numeric', precision: 5, scale: 2, nullable: true })
  customMaxAllowed: number;

  @Column({ name: 'is_exception', default: false })
  isException: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  assignedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}