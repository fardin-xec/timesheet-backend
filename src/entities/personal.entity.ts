// src/entities/personal.entity.ts
import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from './employees.entity';

@Entity('personal')
export class Personal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'employee_id' })
  employeeId: number;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ name: 'alternative_phone', length: 20, nullable: true })
  alternativePhone: string;

  @Column({ name: 'blood_group', length: 10, nullable: true })
  bloodGroup: string;

  @Column({ name: 'marital_status', length: 20, nullable: true })
  maritalStatus: string;

  @Column({ name: 'wedding_anniversary', type: 'date', nullable: true })
  weddingAnniversary: Date;

  @Column({ name: 'current_address', type: 'text', nullable: true })
  currentAddress: string;

  @Column({ name: 'permanent_address', type: 'text', nullable: true })
  permanentAddress: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToOne(() => Employee, employee => employee.personalInfo)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;
}