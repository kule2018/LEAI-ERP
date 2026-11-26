import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_integration_config', { engine: 'InnoDB' })
@Index('uk_sys_integration_channel', ['tenantId', 'channel'], { unique: true })
export class IntegrationConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 24 }) channel!: string
  @Column({ type: 'varchar', length: 100 }) name!: string
  @Column({ name: 'webhook_url', type: 'varchar', length: 500 }) webhookUrl!: string
  @Column({ name: 'secret_encrypted', type: 'varchar', length: 500, nullable: true }) secretEncrypted!: string | null
  @Column({ name: 'secret_mask', type: 'varchar', length: 100, nullable: true }) secretMask!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('sys_integration_message', { engine: 'InnoDB' })
@Index('idx_sys_integration_message', ['tenantId', 'channel'])
export class IntegrationMessageEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 24 }) channel!: string
  @Column({ type: 'varchar', length: 150 }) title!: string
  @Column({ type: 'text', nullable: true }) content!: string | null
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'response_text', type: 'varchar', length: 1000, nullable: true }) responseText!: string | null
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
