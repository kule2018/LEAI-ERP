import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_notify_template', { engine: 'InnoDB' })
@Index('uk_notify_template_code', ['tenantId', 'code'], { unique: true })
export class NotifyTemplateEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 64 }) code!: string
  @Column({ type: 'varchar', length: 120 }) name!: string
  @Column({ type: 'varchar', length: 200 }) title!: string
  @Column({ type: 'varchar', length: 1000 }) content!: string
  @Column({ type: 'varchar', length: 200, nullable: true }) channels!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
