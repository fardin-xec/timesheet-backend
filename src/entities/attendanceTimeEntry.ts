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
import { Attendance } from './attendances.entity';
export enum TimeEntryStatus {
  ACTIVE = 'active',           // Timer is running
  COMPLETED = 'completed',     // Timer stopped normally
  AUTO_STOPPED = 'auto_stopped', // Auto-stopped at midnight
}

@Entity('attendance_time_entries')
@Index(['attendanceId'])
@Index(['employeeId', 'startTime'])
@Index(['status'])
@Index(['taskCategory'])
export class AttendanceTimeEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'attendance_id', nullable: false })
  attendanceId: number;

  @ManyToOne(() => Attendance, (attendance) => attendance.timeEntries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attendance_id' })
  attendance: Attendance;

  @Column({ name: 'employee_id', nullable: false })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  // Time tracking fields
  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime: Date;

  @Column({ 
    type: 'enum', 
    enum: TimeEntryStatus, 
    default: TimeEntryStatus.ACTIVE 
  })
  status: TimeEntryStatus;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes: number;

  // Task fields (combined from TaskLog)
  @Column({ name: 'task_description', type: 'text', nullable: true })
  taskDescription: string;

  @Column({ name: 'task_category', type: 'varchar', length: 100, nullable: true })
  taskCategory: string; // e.g., 'Development', 'Meeting', 'Documentation'

  @Column({ name: 'estimated_time_minutes', type: 'int', nullable: true })
  estimatedTimeMinutes: number;

  @Column({ name: 'project_name', type: 'varchar', length: 200, nullable: true })
  projectName: string; // Optional: for better task organization

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string; // Optional: additional notes or comments

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}