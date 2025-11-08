// src/entities/leave.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
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

export enum HalfDayType {
  FIRST_HALF = 'first_half',
  SECOND_HALF = 'second_half',
}

@Entity('leaves')
export class Leave {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'employee_id' })
  employeeId: number;

  @Column({ name: 'leave_type', type: 'enum', enum: LeaveType })
  leaveType: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ name: 'applied_days', type: 'decimal', precision: 4, scale: 1, default: 1 })
  appliedDays: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({
    type: 'enum',
    enum: LeaveStatus,
    default: LeaveStatus.PENDING,
  })
  status: LeaveStatus;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: number;

  @Column({ name: 'is_half_day', type: 'boolean', default: false })
  isHalfDay: boolean;

  @Column({
    name: 'half_day_type',
    type: 'enum',
    enum: HalfDayType,
    nullable: true,
  })
  halfDayType: HalfDayType;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Employee, { eager: true })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver: Employee;
}
