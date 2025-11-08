// src/entities/leave-balance.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { Employee } from './employees.entity';
import { LeaveType } from './leave.entity';

@Entity('leave_balances')
@Unique(['employee', 'leaveType', 'year'])
export class LeaveBalances {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'leave_type', type: 'enum', enum: LeaveType })
  leaveType: LeaveType;

  @Column()
  year: number;

  @Column({ name: 'total_allowed', type: 'numeric', precision: 5, scale: 2, default: 0 })
  totalAllowed: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  used: number;

  @Column({ name: 'carry_forwarded', type: 'numeric', precision: 5, scale: 2, default: 10 })
  carryForwarded: number;

  @Column({ name: 'pending', type: 'numeric', precision: 5, scale: 2, default: 0 })
  pending: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}