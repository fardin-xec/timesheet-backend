import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Employee } from './employees.entity';
import { Organization } from './organizations.entity';

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  ON_LEAVE = 'on_leave',
  HALF_DAY = 'half_day',
}

@Entity('attendances')
@Index(['employeeId', 'attendanceDate'], { unique: true })
@Index(['attendanceDate'])
@Index(['status'])
@Index(['orgId'])
export class Attendance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'employee_id', nullable: false })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'org_id', nullable: false })
  orgId: number;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate: Date;

  @Column({ type: 'enum', enum: AttendanceStatus, nullable: true })
  status: AttendanceStatus;

  @Column({ name: 'check_in_time', type: 'time', nullable: true })
  checkInTime: string;

  @Column({ name: 'check_out_time', type: 'time', nullable: true })
  checkOutTime: string;

  @Column({ name: 'tasks_performed', type: 'varchar', length: 1000, nullable: true })
  tasksPerformed: string;

  @Column({ name: 'total_working_hours', type: 'decimal', precision: 5, scale: 2, nullable: true })
  totalWorkingHours: number; // Stores hours as a decimal (e.g., 8.50 for 8 hours 30 minutes)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}