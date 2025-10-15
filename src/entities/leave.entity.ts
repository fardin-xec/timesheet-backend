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

 @Column({ default: 'annual' }) // ✅ Replace 'annual' with a valid default
leaveType: string;

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date',nullable: true })
  endDate: Date;

  @Column({ type: 'decimal', precision: 4, scale: 1 ,default: 1 })
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

  @Column({ type: 'boolean', default: false })
  isHalfDay: boolean;

  @Column({
    type: 'enum',
    enum: HalfDayType,
    nullable: true,
  })
  halfDayType: HalfDayType;

  @Column({ name: 'document_id', type: 'uuid', nullable: true, default: null })
  documentId: string;

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
