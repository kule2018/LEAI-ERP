import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_notify', { engine: 'InnoDB' })
@Index('idx_sys_notify_receiver_read', ['tenantId', 'receiverId', 'readFlag'])
export class NotificationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'notify_no', type: 'varchar', length: 60 })
  notifyNo!: string

  @Column({ type: 'varchar', length: 120 })
  title!: string

  @Column({ type: 'varchar', length: 1000, nullable: true })
  content!: string | null

  @Column({ type: 'varchar', length: 24 })
  channel!: string

  @Column({ name: 'target_address', type: 'varchar', length: 120, nullable: true })
  targetAddress!: string | null

  @Column({ name: 'receiver_id', type: 'bigint' })
  receiverId!: number

  @Column({ name: 'read_flag', type: 'varchar', length: 16, default: 'NO' })
  readFlag!: string

  @Column({ name: 'biz_type', type: 'varchar', length: 64, nullable: true })
  bizType!: string | null
  @Column({ name: 'biz_id', type: 'bigint', nullable: true })
  bizId!: number | null

  @Column({ name: 'template_code', type: 'varchar', length: 64, nullable: true })
  templateCode!: string | null

  @Column({ name: 'send_user_id', type: 'bigint', nullable: true })
  sendUserId!: number | null

  @Column({ name: 'send_status', type: 'varchar', length: 24, default: 'SUCCESS' })
  sendStatus!: string

  @Column({ name: 'delivered_at', type: 'datetime', precision: 3, nullable: true })
  deliveredAt!: Date | null

  @Column({ name: 'gateway_message_id', type: 'varchar', length: 80, nullable: true })
  gatewayMessageId!: string | null

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number

  @Column({ name: 'last_error', type: 'varchar', length: 1000, nullable: true })
  lastError!: string | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
