import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  ManyToOne, 
  OneToMany,
  JoinColumn, 
  CreateDateColumn, 
  UpdateDateColumn, 
  Index 
} from 'typeorm';
import { Employee } from './employees.entity';
import { Organization } from './organizations.entity';
import { AttendanceTimeEntry } from './attendanceTimeEntry';

// ============================================
// 1. Daily Attendance Summary Entity
// ============================================
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

  @Column({ type: 'enum', enum: AttendanceStatus, default: AttendanceStatus.PRESENT })
  status: AttendanceStatus;

  @Column({ name: 'total_working_hours', type: 'decimal', precision: 5, scale: 2, default: 0 })
  totalWorkingHours: number;

  // Relation to time entries
  @OneToMany(() => AttendanceTimeEntry, (entry) => entry.attendance, { cascade: true })
  timeEntries: AttendanceTimeEntry[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}