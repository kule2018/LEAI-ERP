import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 登录日志台账：记录成功、失败与锁定，含来源 IP、UA 与失败原因 */
@Entity('sys_login_log', { engine: 'InnoDB' })
@Index('idx_sys_login_log_tenant_at', ['tenantId', 'loginAt'])
@Index('idx_sys_login_log_user', ['tenantId', 'userId'])
export class LoginLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint', default: 0 })
  tenantId!: number

  @Column({ name: 'user_id', type: 'bigint', nullable: true })
  userId!: number | null

  @Column({ type: 'varchar', length: 64 })
  username!: string

  @Column({ name: 'login_ip', type: 'varchar', length: 64, nullable: true })
  loginIp!: string | null

  /** SUCCESS / FAIL / LOCKED */
  @Column({ name: 'login_result', type: 'varchar', length: 24, default: 'FAIL' })
  loginResult!: string

  @Column({ name: 'fail_reason', type: 'varchar', length: 255, nullable: true })
  failReason!: string | null

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent!: string | null

  @Column({ name: 'login_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  loginAt!: Date
}
