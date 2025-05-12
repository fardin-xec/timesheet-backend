// src/entities/dropdown-type.entity.ts
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DropdownValue } from './dropdown-values.entity';

@Entity('dropdown_types')
export class DropdownType {
  @PrimaryGeneratedColumn({ name: 'type_id' })
  typeId: number;

  @Column({ name: 'type_name', nullable: true, unique: true })
  typeName: string;

  // Relations
  @OneToMany(() => DropdownValue, dropdownValue => dropdownValue.type)
  values: DropdownValue[];
}