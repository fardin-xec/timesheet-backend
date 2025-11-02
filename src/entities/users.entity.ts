// src/entities/user.entity.ts
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Organization } from './organizations.entity';
import { Employee } from './employees.entity';

export enum UserRole {
  ADMIN = 'admin',
  SUPERADMIN = 'superadmin',
  USER = 'user'
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  id: number;

  @Column({ length: 50, unique: false })
  username: string;

  @Column({ name: 'email', length: 100, unique: true })
  email: string;

  @Column({ length: 255 })
  password: string;

  @Column({
    name: 'role',
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER
  })
  role: UserRole;

  @Column({ name: 'otp', length: 6, nullable: true })
  otp: string;

  @Column({ name: 'otp_expires_at', type: 'timestamp', nullable: true })
  otpExpiresAt: Date;

  @Column({ name: 'otp_attempts', default: 0 })
  otpAttempts: number;

  @Column({ name: 'org_id', nullable: true })
  orgId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, organization => organization.users)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @OneToOne(() => Employee, employee => employee.user)
  employee: Employee;
}