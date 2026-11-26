import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 备份策略 */
@Entity('sys_backup_policy', { engine: 'InnoDB' })
@Index('idx_sys_backup_policy', ['tenantId', 'policyCode'], { unique: true })
export class SysBackupPolicyEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'policy_code', type: 'varchar', length: 60 }) policyCode!: string
  @Column({ name: 'policy_name', type: 'varchar', length: 120 }) policyName!: string
  /** FULL 全量 / INCREMENTAL 增量 */
  @Column({ name: 'backup_type', type: 'varchar', length: 16, default: 'FULL' }) backupType!: string
  /** 触发间隔（分钟） */
  @Column({ name: 'interval_minutes', type: 'int', default: 1440 }) intervalMinutes!: number
  /** 保留天数 */
  @Column({ name: 'retention_days', type: 'int', default: 30 }) retentionDays!: number
  /** 本地存储目录 */
  @Column({ name: 'storage_path', type: 'varchar', length: 300 }) storagePath!: string
  /** 异地存储目录 */
  @Column({ name: 'remote_path', type: 'varchar', length: 300, nullable: true }) remotePath!: string | null
  @Column({ name: 'remote_enabled', type: 'tinyint', default: 0 }) remoteEnabled!: number
  @Column({ type: 'varchar', length: 16, default: 'ENABLED' }) status!: string
  @Column({ name: 'last_run_at', type: 'datetime', nullable: true }) lastRunAt!: Date | null
  @Column({ name: 'last_result', type: 'varchar', length: 300, nullable: true }) lastResult!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 备份执行记录 */
@Entity('sys_backup_record', { engine: 'InnoDB' })
@Index('idx_sys_backup_record', ['tenantId', 'status'])
export class SysBackupRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'backup_no', type: 'varchar', length: 60 }) backupNo!: string
  @Column({ name: 'policy_id', type: 'bigint', nullable: true }) policyId!: number | null
  @Column({ name: 'policy_code', type: 'varchar', length: 60, default: '' }) policyCode!: string
  @Column({ name: 'backup_type', type: 'varchar', length: 16, default: 'FULL' }) backupType!: string
  /** RUNNING / SUCCESS / FAILED */
  @Column({ type: 'varchar', length: 16, default: 'RUNNING' }) status!: string
  @Column({ name: 'file_name', type: 'varchar', length: 200, default: '' }) fileName!: string
  @Column({ name: 'file_path', type: 'varchar', length: 400, nullable: true }) filePath!: string | null
  @Column({ name: 'file_size', type: 'bigint', default: 0 }) fileSize!: number
  @Column({ name: 'duration_ms', type: 'int', default: 0 }) durationMs!: number
  @Column({ name: 'error_message', type: 'varchar', length: 500, nullable: true }) errorMessage!: string | null
  @Column({ name: 'is_offsite', type: 'tinyint', default: 0 }) isOffsite!: number
  @Column({ name: 'operator_id', type: 'bigint', nullable: true }) operatorId!: number | null
  @Column({ name: 'started_at', type: 'datetime', nullable: true }) startedAt!: Date | null
  @Column({ name: 'finished_at', type: 'datetime', nullable: true }) finishedAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 恢复单（演练与真实恢复台账） */
@Entity('sys_restore_record', { engine: 'InnoDB' })
@Index('idx_sys_restore_record', ['tenantId', 'status'])
export class SysRestoreRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'restore_no', type: 'varchar', length: 60 }) restoreNo!: string
  @Column({ name: 'backup_id', type: 'bigint' }) backupId!: number
  @Column({ name: 'backup_no', type: 'varchar', length: 60, default: '' }) backupNo!: string
  /** DRY_RUN 恢复演练 / FULL 真实恢复 */
  @Column({ name: 'restore_mode', type: 'varchar', length: 16, default: 'DRY_RUN' }) restoreMode!: string
  @Column({ name: 'target_env', type: 'varchar', length: 60, default: '' }) targetEnv!: string
  /** PENDING / SUCCESS / FAILED */
  @Column({ type: 'varchar', length: 16, default: 'PENDING' }) status!: string
  @Column({ name: 'result_message', type: 'varchar', length: 500, nullable: true }) resultMessage!: string | null
  @Column({ name: 'operator_note', type: 'varchar', length: 300, nullable: true }) operatorNote!: string | null
  @Column({ name: 'operator_id', type: 'bigint', nullable: true }) operatorId!: number | null
  @Column({ name: 'started_at', type: 'datetime', nullable: true }) startedAt!: Date | null
  @Column({ name: 'finished_at', type: 'datetime', nullable: true }) finishedAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
