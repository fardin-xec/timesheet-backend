import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Organization } from '../entities/organizations.entity';

@Entity('tax_regimes')
export class TaxRegime {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'org_id' })
  orgId: number;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ type: 'jsonb' }) // Store tax brackets as JSON
  taxBrackets: Array<{
    minAmount: number;
    maxAmount: number | null; // null for upper bound
    rate: number;
  }>;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 3 }) // Add currency field (e.g., 'QAR', 'INR')
  currency: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}