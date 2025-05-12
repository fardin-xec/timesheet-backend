// src/entities/organization.entity.ts
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from './users.entity';
import { Employee } from './employees.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn({ name: 'org_id' })
  orgId: number;

  @Column({ name: 'org_name', nullable: true })
  orgName: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  domain: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => User, user => user.organization)
  users: User[];

  @OneToMany(() => Employee, employee => employee.organization)
  employees: Employee[];
}