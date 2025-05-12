import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from './employees.entity';
import {LeaveType}  from './leave.entity'


@Entity('leave_balances')
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

  @Column({name: 'total_allowed', type: 'numeric', precision: 5, scale: 2, default: 0 })
  totalAllowed: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  used: number;

  @Column({name: 'carry_forwarded', type: 'numeric', precision: 5, scale: 2, default: 0 })
  carryForwarded: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}





