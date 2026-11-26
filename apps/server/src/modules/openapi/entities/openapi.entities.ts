import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_api_key', { engine: 'InnoDB' })
@Index('uk_sys_api_key_id', ['tenantId', 'keyId'], { unique: true })
export class ApiKeyEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'key_id', type: 'varchar', length: 60 }) keyId!: string
  @Column({ name: 'secret_hash', type: 'varchar', length: 200 }) secretHash!: string
  @Column({ type: 'varchar', length: 100 }) name!: string
  @Column({ type: 'json' }) scopes!: string[]
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'last_used_at', type: 'datetime', nullable: true }) lastUsedAt!: Date | null
  @Column({ name: 'expires_at', type: 'datetime', nullable: true }) expiresAt!: Date | null
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('sys_webhook', { engine: 'InnoDB' })
@Index('idx_sys_webhook_tenant', ['tenantId', 'status'])
export class WebhookEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 100 }) name!: string
  @Column({ type: 'varchar', length: 500 }) url!: string
  @Column({ name: 'event_types', type: 'json' }) eventTypes!: string[]
  @Column({ name: 'secret_encrypted', type: 'varchar', length: 500, nullable: true }) secretEncrypted!: string | null
  @Column({ name: 'secret_mask', type: 'varchar', length: 100, nullable: true }) secretMask!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'retry_limit', type: 'int', default: 3 }) retryLimit!: number
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('sys_webhook_delivery', { engine: 'InnoDB' })
@Index('idx_sys_webhook_delivery', ['tenantId', 'status'])
export class WebhookDeliveryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'webhook_id', type: 'bigint' }) webhookId!: number
  @Column({ name: 'event_type', type: 'varchar', length: 80 }) eventType!: string
  @Column({ type: 'json' }) payload!: Record<string, unknown>
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'attempt_count', type: 'int', default: 0 }) attemptCount!: number
  @Column({ name: 'response_text', type: 'varchar', length: 1000, nullable: true }) responseText!: string | null
  @Column({ name: 'next_retry_at', type: 'datetime', nullable: true }) nextRetryAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'delivered_at', type: 'datetime', nullable: true }) deliveredAt!: Date | null
}
