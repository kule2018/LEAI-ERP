import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_feature_flag', { engine: 'InnoDB' })
@Index('uk_sys_feature_flag_code', ['tenantId', 'code'], { unique: true })
export class FeatureFlagEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 80 }) code!: string
  @Column({ type: 'varchar', length: 120 }) name!: string
  @Column({ type: 'varchar', length: 60 }) module!: string
  @Column({ type: 'varchar', length: 24, default: 'ON' }) status!: string
  @Column({ name: 'gray_users', type: 'json', nullable: true }) grayUsers!: number[] | null
  @Column({ name: 'gray_roles', type: 'json', nullable: true }) grayRoles!: string[] | null
  @Column({ name: 'gray_percent', type: 'int', default: 0 }) grayPercent!: number
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}
