import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AutoPartEntity } from '../../auto-parts/entities/auto-part.entity.js';

/**
 * Стани заявки на підбір запчастини за VIN-кодом (варіант 7 - автозапчастини).
 */
export enum PartRequestStatus {
  New = 'NEW',
  InReview = 'IN_REVIEW',
  PartFound = 'PART_FOUND',
  Rejected = 'REJECTED',
}

@Entity('part_requests')
export class PartRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 17, name: 'vin_code', unique: true })
  vinCode!: string;

  @Column({ type: 'varchar', length: 254, name: 'customer_email' })
  customerEmail!: string;

  @Column({ type: 'varchar', length: 150, name: 'requested_part' })
  requestedPart!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: PartRequestStatus,
    default: PartRequestStatus.New,
  })
  status!: PartRequestStatus;

  @ManyToOne(() => AutoPartEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'found_part_id' })
  foundPart!: AutoPartEntity | null;

  @Column({
    type: 'varchar',
    length: 500,
    name: 'manager_note',
    nullable: true,
  })
  managerNote!: string | null;

  @Column({
    type: 'timestamp with time zone',
    name: 'notified_at',
    nullable: true,
  })
  notifiedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
