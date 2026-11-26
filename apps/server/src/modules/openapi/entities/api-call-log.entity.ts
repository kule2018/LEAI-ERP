import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_api_call_log', { engine: 'InnoDB' })
@Index('idx_api_call_log', ['tenantId', 'apiKeyId'])
export class ApiCallLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'api_key_id', type: 'bigint' }) apiKeyId!: number
  @Column({ type: 'varchar', length: 10 }) method!: string
  @Column({ type: 'varchar', length: 300 }) path!: string
  @Column({ type: 'int', default: 200 }) status!: number
  @Column({ name: 'duration_ms', type: 'int', default: 0 }) durationMs!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
