import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Organization } from './organizations.entity';
import {LeaveType}  from './leave.entity'
import { Gender } from './employees.entity';

@Entity('leave_rules')
export class LeaveRule {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({name:'leave_type', type: 'enum', enum: LeaveType })
  leaveType: LeaveType;

  @Column({name:'max_allowed', type: 'numeric', precision: 5, scale: 2 })
  maxAllowed: number;

  @Column({name:'carry_forward_max', type: 'numeric', precision: 5, scale: 2, default: 0 })
  carryForwardMax: number;

  @Column({name:'accrual_rate', type: 'numeric', precision: 5, scale: 2, nullable: true })
  accrualRate: number;

  @Column({name:'is_active', default: true })
  isActive: boolean;

  @Column({name:'applicable_gender', type: 'enum', enum: Gender, nullable: true })
  applicableGender: Gender;

  @Column({name:'min_tenure_months', default: 0 })
  minTenureMonths: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}