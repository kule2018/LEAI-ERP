import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 租户级系统参数：键值对配置，支持字符串/数字/布尔/JSON */
@Entity('sys_config', { engine: 'InnoDB' })
@Index('uk_sys_config_key', ['tenantId', 'configKey'], { unique: true })
@Index('idx_sys_config_tenant_deleted', ['tenantId', 'isDeleted'])
export class SystemConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint', default: 0 })
  tenantId!: number

  @Column({ name: 'config_key', type: 'varchar', length: 100 })
  configKey!: string

  @Column({ name: 'config_value', type: 'text', nullable: true })
  configValue!: string | null

  /** STRING / NUMBER / BOOLEAN / JSON */
  @Column({ name: 'value_type', type: 'varchar', length: 24, default: 'STRING' })
  valueType!: string

  @Column({ type: 'varchar', length: 60, nullable: true })
  category!: string | null

  @Column({ name: 'is_system', type: 'tinyint', width: 1, default: 0 })
  isSystem!: number

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy!: number | null

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt!: Date | null

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
