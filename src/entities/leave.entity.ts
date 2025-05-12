import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from './employees.entity';

export enum LeaveType {
  CASUAL = 'casual',
  SICK = 'sick',
  ANNUAL = 'annual',
  MATERNITY = 'maternity',
  EMERGENCY = 'emergency',
  LOSSOFPAY = 'lossOfPay',
}

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity('leaves')
export class Leave {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'employee_id', nullable: true })
  employeeId: number;


  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name:'leave_type',type: 'enum', enum: LeaveType })
  leaveType: LeaveType;

  @Column({ name:'start_date',type: 'date' })
  startDate: Date;

  @Column({name:'end_date', type: 'date' })
  endDate: Date;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'enum', enum: LeaveStatus, default: LeaveStatus.PENDING })
  status: LeaveStatus;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: number;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by' })
  manager: Employee;

  @Column({name: 'applied_days', type: 'numeric', precision: 5, scale: 2 })
  appliedDays: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

