import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './users.entity';
import { Employee } from './employees.entity';

export enum AuditTrailAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
  MARKED_INACTIVE = 'MARKED_INACTIVE',
  MARKED_ACTIVE = 'MARKED_ACTIVE',
  STATUS_CHANGED = 'STATUS_CHANGED',
}

@Entity('audit_trail')
export class AuditTrail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: AuditTrailAction,
    default: AuditTrailAction.UPDATED,
  })
  action: AuditTrailAction;

  @Column({ name: 'employee_id', nullable: true })
  employeeId: number;

  @Column({ length: 100, nullable: true })
  employeeEmployeeId: string;

  @Column({ length: 100, nullable: true })
  employeeName: string;

  @Column({ length: 255, nullable: true })
  employeeEmail: string;

  @Column({ type: 'text', nullable: true })
  changes: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  previousStatus: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  newStatus: string;

  @Column({ name: 'edited_by', nullable: true })
  editedBy: number;


  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  actionDate: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'edited_by' })
  editedByUser: User;

  @ManyToOne(() => Employee, (employee) => employee.auditTrails, {
    nullable: true,
  })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;
}
