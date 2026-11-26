import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** BOM 变更申请与审批记录 */
@Entity('mes_bom_change', { engine: 'InnoDB' })
@Index('idx_mes_bom_change', ['tenantId', 'bomId'])
export class MesBomChangeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'bom_id', type: 'bigint' }) bomId!: number
  @Column({ name: 'from_version', type: 'varchar', length: 20, nullable: true }) fromVersion!: string | null
  @Column({ name: 'to_version', type: 'varchar', length: 20 }) toVersion!: string
  @Column({ name: 'change_type', type: 'varchar', length: 24, default: 'UPDATE' }) changeType!: string
  @Column({ type: 'json', nullable: true }) diff!: Record<string, unknown> | null
  @Column({ name: 'change_reason', type: 'varchar', length: 500, nullable: true }) changeReason!: string | null
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'submitted_by', type: 'bigint' }) submittedBy!: number
  @Column({ name: 'approved_by', type: 'bigint', nullable: true }) approvedBy!: number | null
  @Column({ name: 'approved_at', type: 'datetime', nullable: true }) approvedAt!: Date | null
  @Column({ name: 'approve_comment', type: 'varchar', length: 500, nullable: true }) approveComment!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 工单变更记录（数量/计划/工艺调整） */
@Entity('mes_work_order_change', { engine: 'InnoDB' })
@Index('idx_mes_work_order_change', ['tenantId', 'workOrderId'])
export class MesWorkOrderChangeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'work_order_id', type: 'bigint' }) workOrderId!: number
  @Column({ name: 'change_version', type: 'int', default: 1 }) changeVersion!: number
  @Column({ name: 'change_type', type: 'varchar', length: 24 }) changeType!: string
  @Column({ name: 'before_value', type: 'json', nullable: true }) beforeValue!: Record<string, unknown> | null
  @Column({ name: 'after_value', type: 'json', nullable: true }) afterValue!: Record<string, unknown> | null
  @Column({ name: 'change_reason', type: 'varchar', length: 500, nullable: true }) changeReason!: string | null
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'approved_by', type: 'bigint', nullable: true }) approvedBy!: number | null
  @Column({ name: 'approved_at', type: 'datetime', nullable: true }) approvedAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 质检检验项明细 */
@Entity('mes_qc_item', { engine: 'InnoDB' })
@Index('idx_mes_qc_item', ['tenantId', 'qcId'])
export class MesQcItemEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'qc_id', type: 'bigint' }) qcId!: number
  @Column({ name: 'item_code', type: 'varchar', length: 50 }) itemCode!: string
  @Column({ name: 'item_name', type: 'varchar', length: 100 }) itemName!: string
  @Column({ name: 'standard_value', type: 'decimal', precision: 18, scale: 4, nullable: true }) standardValue!: string | null
  @Column({ name: 'measured_value', type: 'decimal', precision: 18, scale: 4, nullable: true }) measuredValue!: string | null
  @Column({ name: 'upper_limit', type: 'decimal', precision: 18, scale: 4, nullable: true }) upperLimit!: string | null
  @Column({ name: 'lower_limit', type: 'decimal', precision: 18, scale: 4, nullable: true }) lowerLimit!: string | null
  @Column({ name: 'is_qualified', type: 'tinyint', width: 1, default: 0 }) isQualified!: number
  @Column({ name: 'item_result', type: 'varchar', length: 500, nullable: true }) itemResult!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 设备故障报修与停机记录 */
@Entity('mes_equipment_fault', { engine: 'InnoDB' })
@Index('idx_mes_equipment_fault', ['tenantId', 'equipmentId'])
export class MesEquipmentFaultEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'equipment_id', type: 'bigint' }) equipmentId!: number
  @Column({ name: 'fault_no', type: 'varchar', length: 60 }) faultNo!: string
  @Column({ name: 'fault_type', type: 'varchar', length: 32, default: 'MECHANICAL' }) faultType!: string
  @Column({ name: 'fault_desc', type: 'varchar', length: 500, nullable: true }) faultDesc!: string | null
  @Column({ name: 'reported_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) reportedAt!: Date
  @Column({ name: 'repaired_at', type: 'datetime', nullable: true }) repairedAt!: Date | null
  @Column({ name: 'downtime_minutes', type: 'int', default: 0 }) downtimeMinutes!: number
  @Column({ name: 'stop_line_at', type: 'datetime', nullable: true }) stopLineAt!: Date | null
  @Column({ name: 'stop_line_end', type: 'datetime', nullable: true }) stopLineEnd!: Date | null
  @Column({ name: 'delay_days', type: 'decimal', precision: 10, scale: 2, default: 0 }) delayDays!: string
  @Column({ name: 'work_order_id', type: 'bigint', nullable: true }) workOrderId!: number | null
  @Column({ name: 'repair_result', type: 'varchar', length: 500, nullable: true }) repairResult!: string | null
  @Column({ type: 'varchar', length: 24, default: 'OPEN' }) status!: string
  @Column({ name: 'reported_by', type: 'bigint' }) reportedBy!: number
  @Column({ name: 'repaired_by', type: 'bigint', nullable: true }) repairedBy!: number | null
}

/** 设备保养计划与保养单 */
@Entity('mes_equipment_maintenance', { engine: 'InnoDB' })
@Index('idx_mes_equipment_maintenance', ['tenantId', 'equipmentId'])
export class MesEquipmentMaintenanceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'equipment_id', type: 'bigint' }) equipmentId!: number
  @Column({ name: 'maintenance_no', type: 'varchar', length: 60 }) maintenanceNo!: string
  @Column({ name: 'plan_date', type: 'date', nullable: true }) planDate!: string | null
  @Column({ name: 'cycle_days', type: 'int', default: 30 }) cycleDays!: number
  @Column({ name: 'maintenance_type', type: 'varchar', length: 32, default: 'ROUTINE' }) maintenanceType!: string
  @Column({ name: 'maintenance_content', type: 'varchar', length: 500, nullable: true }) maintenanceContent!: string | null
  @Column({ name: 'executed_at', type: 'datetime', nullable: true }) executedAt!: Date | null
  @Column({ name: 'executor_id', type: 'bigint', nullable: true }) executorId!: number | null
  @Column({ name: 'execute_result', type: 'varchar', length: 500, nullable: true }) executeResult!: string | null
  @Column({ type: 'varchar', length: 24, default: 'PLANNED' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 超额领料审批单 */
@Entity('mes_over_issue_approval', { engine: 'InnoDB' })
@Index('idx_mes_over_issue_approval', ['tenantId', 'workOrderId'])
export class MesOverIssueApprovalEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'work_order_id', type: 'bigint' }) workOrderId!: number
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: number
  @Column({ name: 'required_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) requiredQty!: string
  @Column({ name: 'issued_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) issuedQty!: string
  @Column({ name: 'over_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) overQty!: string
  @Column({ name: 'request_reason', type: 'varchar', length: 500, nullable: true }) requestReason!: string | null
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'requested_by', type: 'bigint' }) requestedBy!: number
  @Column({ name: 'approved_by', type: 'bigint', nullable: true }) approvedBy!: number | null
  @Column({ name: 'approved_at', type: 'datetime', nullable: true }) approvedAt!: Date | null
  @Column({ name: 'approve_comment', type: 'varchar', length: 500, nullable: true }) approveComment!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 换线时间主数据（工作中心 + 前产品 → 后产品） */
@Entity('mes_changeover_rule', { engine: 'InnoDB' })
@Index('idx_mes_changeover_rule', ['tenantId', 'workCenterId'])
export class MesChangeoverRuleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  /** 工作中心（null 表示通用规则） */
  @Column({ name: 'work_center_id', type: 'bigint', nullable: true }) workCenterId!: number | null
  /** 前产品（null 表示通用） */
  @Column({ name: 'from_product_id', type: 'bigint', nullable: true }) fromProductId!: number | null
  /** 后产品（null 表示通用） */
  @Column({ name: 'to_product_id', type: 'bigint', nullable: true }) toProductId!: number | null
  /** 换线耗时（分钟） */
  @Column({ type: 'int', default: 0 }) minutes!: number
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 换线记录（排产任务切换产品时的换线登记） */
@Entity('mes_changeover_log', { engine: 'InnoDB' })
@Index('idx_mes_changeover_log', ['tenantId', 'workCenterId'])
export class MesChangeoverLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'plan_task_id', type: 'bigint' }) planTaskId!: number
  @Column({ name: 'work_center_id', type: 'bigint', nullable: true }) workCenterId!: number | null
  @Column({ name: 'from_product_id', type: 'bigint', nullable: true }) fromProductId!: number | null
  @Column({ name: 'to_product_id', type: 'bigint', nullable: true }) toProductId!: number | null
  /** 换线耗时（分钟） */
  @Column({ type: 'int', default: 0 }) minutes!: number
  @Column({ name: 'start_at', type: 'datetime' }) startAt!: Date
  @Column({ name: 'end_at', type: 'datetime' }) endAt!: Date
  /** PLANNED 已计划 / DONE 已完成 */
  @Column({ type: 'varchar', length: 24, default: 'PLANNED' }) status!: string
  /** DRAG 拖拽排产触发 / AUTO 排程自动累加 */
  @Column({ type: 'varchar', length: 16, default: 'AUTO' }) source!: string
  @Column({ name: 'operator_id', type: 'bigint', nullable: true }) operatorId!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 排产任务锁定记录（锁定后不可拖拽/不可修改时间） */
@Entity('mes_plan_task_lock', { engine: 'InnoDB' })
@Index('idx_mes_plan_task_lock', ['tenantId', 'planTaskId'])
export class MesPlanTaskLockEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'plan_task_id', type: 'bigint' }) planTaskId!: number
  @Column({ name: 'locked_by', type: 'bigint' }) lockedBy!: number
  @Column({ name: 'locked_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) lockedAt!: Date
  @Column({ name: 'unlocked_at', type: 'datetime', nullable: true }) unlockedAt!: Date | null
  @Column({ name: 'unlocked_by', type: 'bigint', nullable: true }) unlockedBy!: number | null
  @Column({ name: 'lock_reason', type: 'varchar', length: 500, nullable: true }) lockReason!: string | null
  @Column({ type: 'varchar', length: 24, default: 'LOCKED' }) status!: string
}
