// src/entities/employee.entity.ts
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Organization } from './organizations.entity';
import { User } from './users.entity';
import { Personal } from './personal.entity';
import { BankInfo } from './bank-info.entity';
import { Leave } from './leave.entity';
import { Payroll } from './payrolls.entity';

export enum EmployeeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_LEAVE = 'on_leave'
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}



@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'employee_id', length: 50 })
  employeeId: string;

  @Column({ name: 'first_name', length: 50 })
  firstName: string;

  @Column({ name: 'middle_name', length: 50,  nullable: true })
  midName: string;

  @Column({ name: 'last_name', length: 50 })
  lastName: string;

  @Column({ name: 'email', length: 100, unique: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({
    type: 'enum',
    enum: EmployeeStatus,
    default: EmployeeStatus.ACTIVE
  })
  status: EmployeeStatus;

  @Column({ length: 100, nullable: true })
  designation: string;

  @Column({ length: 255, nullable: true })
  avatar: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ name: 'job_title', length: 100, nullable: true })
  jobTitle: string;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true
  })
  gender: Gender;

  @Column({ length: 100, nullable: true })
  department: string;

  @Column({ name: 'is_probation', default: false })
  isProbation: boolean;

  @Column({ name: 'probation_period', default: 0 })
  probationPeriod: number;

  @Column({name: 'employment_type', length: 100, nullable: true })
  employmentType: string;

  @Column({ name: 'joining_date', type: 'date' })
  joiningDate: Date;

  @Column({ name: 'dob', type: 'date' })
  dob: Date;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  ctc: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ name: 'user_id', nullable: true, unique: true })
  userId: number;

  @Column({ name: 'org_id', nullable: true })
  orgId: number;

  @Column({ name: 'report_to', nullable: true })
  reportTo: number;

  // Relations
  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Organization, organization => organization.employees)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Employee, employee => employee.subordinates)
  @JoinColumn({ name: 'report_to' })
  manager: Employee;

  @OneToMany(() => Employee, employee => employee.manager)
  subordinates: Employee[];

  @OneToOne(() => Personal, personal => personal.employee)
  personalInfo: Personal;

  @OneToMany(() => BankInfo, bankInfo => bankInfo.employee)
  bankAccounts: BankInfo;

  @OneToMany(() => Leave, leave => leave.employee) // Add this relation
  leaves: Leave[];

  @OneToMany(() => Payroll, payroll => payroll.employee) // Add this relation
  payrolls: Payroll[];
}