import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 劳动合同：员工档案的合同主数据，支持到期提醒、续签与解除留痕。
 */
@Entity('hr_labor_contract', { engine: 'InnoDB' })
@Index('idx_hr_labor_contract_tenant', ['tenantId', 'status'])
@Index('idx_hr_labor_contract_employee', ['tenantId', 'employeeId'])
@Index('idx_hr_labor_contract_expiry', ['tenantId', 'expiryDate'])
export class HrLaborContractEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'employee_id', type: 'bigint' }) employeeId!: number
  @Column({ name: 'contract_no', type: 'varchar', length: 40 }) contractNo!: string
  /** FIXED 固定期限 / OPEN_ENDED 无固定期限 / OUTSOURCE 外包 / INTERN 实习 / SERVICE 劳务 */
  @Column({ name: 'contract_type', type: 'varchar', length: 24, default: 'FIXED' }) contractType!: string
  /** 甲方主体 */
  @Column({ name: 'party_a', type: 'varchar', length: 120, nullable: true }) partyA!: string | null
  @Column({ name: 'sign_date', type: 'date', nullable: true }) signDate!: string | null
  @Column({ name: 'effective_date', type: 'date' }) effectiveDate!: string
  @Column({ name: 'expiry_date', type: 'date', nullable: true }) expiryDate!: string | null
  /** 到期提醒提前天数 */
  @Column({ name: 'remind_days', type: 'int', default: 30 }) remindDays!: number
  /** DRAFT / EFFECTIVE / EXPIRED / RENEWED / TERMINATED */
  @Column({ type: 'varchar', length: 24, default: 'EFFECTIVE' }) status!: string
  /** 续签来源合同 */
  @Column({ name: 'renewed_from_id', type: 'bigint', nullable: true }) renewedFromId!: number | null
  @Column({ name: 'terminate_date', type: 'date', nullable: true }) terminateDate!: string | null
  @Column({ name: 'terminate_reason', type: 'varchar', length: 300, nullable: true }) terminateReason!: string | null
  /** 合同约定月薪 */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) salary!: string
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) updatedAt!: Date
}
