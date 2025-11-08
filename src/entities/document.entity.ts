import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum DocumentType {
  AADHAR_CARD = 'AADHAR_CARD',
  PAN_CARD = 'PAN_CARD',
  PASSPORT = 'PASSPORT',
  CERTIFICATE = 'CERTIFICATE',
  OTHER = 'OTHER',
  LEAVE = 'LEAVE'
}

@Entity('documents')
@Index(['employeeId', 'documentType'])
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer' }) // Changed from 'number' to 'integer'
  employeeId: number;

  @Column()
  originalName: string;

  @Column()
  filePath: string;

  @Column()
  mimeType: string;

  @Column({ type: 'bigint' }) // This is fine for large numbers
  size: number;

  @Column({
    type: 'enum',
    enum: DocumentType,
    default: DocumentType.OTHER
  })
  documentType: DocumentType;

  @Column({ type: 'integer' })
  uploadedBy: number;

  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}