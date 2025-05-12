// src/entities/dropdown-value.entity.ts
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DropdownType } from './dropdown-types.entity';

@Entity('dropdown_values')
export class DropdownValue {
  @PrimaryGeneratedColumn({ name: 'value_id' })
  valueId: number;

  @Column({ name: 'value_name', length: 100 })
  valueName: string;

  @Column({ name: 'type_id', nullable: true })
  typeId: number;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => DropdownType, dropdownType => dropdownType.values, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'type_id' })
  type: DropdownType;
}