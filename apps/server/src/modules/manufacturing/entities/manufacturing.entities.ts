import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('bom', { engine: 'InnoDB' })
@Index('uk_bom_product_version', ['tenantId', 'productId', 'version'], { unique: true })
export class BomEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'version', type: 'varchar', length: 20 }) version!: string
  @Column({ name: 'base_qty', type: 'decimal', precision: 18, scale: 3, default: 1 }) baseQty!: string
  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 0 }) isActive!: number
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
}

@Entity('bom_item', { engine: 'InnoDB' })
@Index('idx_bom_item', ['tenantId', 'bomId'])
export class BomItemEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'bom_id', type: 'bigint' }) bomId!: number
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'loss_rate', type: 'decimal', precision: 5, scale: 2, default: 0 }) lossRate!: string
  @Column({ name: 'substitute_material_id', type: 'bigint', nullable: true }) substituteMaterialId!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('work_center', { engine: 'InnoDB' })
@Index('uk_work_center_code', ['tenantId', 'centerCode'], { unique: true })
export class WorkCenterEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'center_code', type: 'varchar', length: 50 }) centerCode!: string
  @Column({ name: 'center_name', type: 'varchar', length: 100 }) centerName!: string
  @Column({ name: 'center_type', type: 'varchar', length: 24, default: 'PRODUCTION_LINE' }) centerType!: string
  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 }) capacity!: string
  @Column({ name: 'standard_capacity', type: 'decimal', precision: 18, scale: 3, default: 0 }) standardCapacity!: string
  @Column({ name: 'shift_hours', type: 'decimal', precision: 10, scale: 2, default: 8 }) shiftHours!: string
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('mes_routing', { engine: 'InnoDB' })
@Index('uk_mes_routing', ['tenantId', 'productId', 'version'], { unique: true })
export class RoutingEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'bom_id', type: 'bigint', nullable: true }) bomId!: number | null
  @Column({ name: 'version', type: 'varchar', length: 20 }) version!: string
  @Column({ name: 'effective_from', type: 'date', nullable: true }) effectiveFrom!: string | null
  @Column({ name: 'effective_to', type: 'date', nullable: true }) effectiveTo!: string | null
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('mes_operation', { engine: 'InnoDB' })
@Index('idx_mes_operation', ['tenantId', 'routingId'])
export class OperationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'routing_id', type: 'bigint' }) routingId!: number
  @Column({ name: 'operation_name', type: 'varchar', length: 100 }) operationName!: string
  @Column({ name: 'work_center_id', type: 'bigint', nullable: true }) workCenterId!: number | null
  @Column({ name: 'standard_minutes', type: 'decimal', precision: 10, scale: 2, default: 0 }) standardMinutes!: string
  @Column({ name: 'sort_no', type: 'int', default: 0 }) sortNo!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('mes_mrp_run', { engine: 'InnoDB' })
@Index('idx_mrp_run', ['tenantId', 'createdAt'])
export class MrpRunEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'run_no', type: 'varchar', length: 60 }) runNo!: string
  @Column({ name: 'plan_date', type: 'date', nullable: true }) planDate!: string | null
  @Column({ type: 'varchar', length: 24, default: 'DONE' }) status!: string
  @Column({ type: 'json', nullable: true }) params!: Record<string, unknown> | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('mes_mrp_suggest', { engine: 'InnoDB' })
@Index('idx_mrp_suggest', ['tenantId', 'runId'])
export class MrpSuggestEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'run_id', type: 'bigint' }) runId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'demand_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) demandQty!: string
  @Column({ name: 'available_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) availableQty!: string
  @Column({ name: 'onway_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) onwayQty!: string
  @Column({ name: 'allocated_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) allocatedQty!: string
  @Column({ name: 'net_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) netQty!: string
  @Column({ name: 'suggest_type', type: 'varchar', length: 24, default: 'PURCHASE' }) suggestType!: string
  @Column({ name: 'priority', type: 'int', default: 0 }) priority!: number
  @Column({ name: 'priority_label', type: 'varchar', length: 12, default: 'LOW' }) priorityLabel!: string
  @Column({ name: 'priority_reason', type: 'varchar', length: 500, nullable: true }) priorityReason!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('mes_plan_task', { engine: 'InnoDB' })
@Index('idx_mes_plan_task', ['tenantId', 'startAt'])
export class PlanTaskEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'task_name', type: 'varchar', length: 150 }) taskName!: string
  @Column({ name: 'work_order_id', type: 'bigint', nullable: true }) workOrderId!: number | null
  @Column({ name: 'work_center_id', type: 'bigint', nullable: true }) workCenterId!: number | null
  @Column({ name: 'start_at', type: 'datetime' }) startAt!: Date
  @Column({ name: 'end_at', type: 'datetime' }) endAt!: Date
  @Column({ type: 'varchar', length: 24, default: 'PLANNED' }) status!: string
  @Column({ name: 'locked', type: 'tinyint', width: 1, default: 0 }) locked!: number
  @Column({ name: 'locked_at', type: 'datetime', nullable: true }) lockedAt!: Date | null
  @Column({ name: 'locked_by', type: 'bigint', nullable: true }) lockedBy!: number | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('work_order', { engine: 'InnoDB' })
@Index('uk_work_order_no', ['tenantId', 'orderNo'], { unique: true })
export class WorkOrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'order_no', type: 'varchar', length: 60 }) orderNo!: string
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'bom_id', type: 'bigint', nullable: true }) bomId!: number | null
  @Column({ name: 'routing_id', type: 'bigint', nullable: true }) routingId!: number | null
  @Column({ name: 'parent_work_order_id', type: 'bigint', nullable: true }) parentWorkOrderId!: number | null
  @Column({ name: 'change_version', type: 'int', default: 0 }) changeVersion!: number
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
  @Column({ name: 'warehouse_id', type: 'bigint' }) warehouseId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'produced_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) producedQty!: string
  @Column({ name: 'actual_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) actualQty!: string
  @Column({ name: 'plan_start', type: 'datetime', nullable: true }) planStart!: Date | null
  @Column({ name: 'plan_end', type: 'datetime', nullable: true }) planEnd!: Date | null
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('work_order_issue', { engine: 'InnoDB' })
@Index('idx_work_order_issue', ['tenantId', 'workOrderId'])
export class WorkOrderIssueEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'work_order_id', type: 'bigint' }) workOrderId!: number
  @Column({ name: 'issue_type', type: 'varchar', length: 16 }) issueType!: string
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'batch_no', type: 'varchar', length: 60, nullable: true }) batchNo!: string | null
  @Column({ name: 'scan_code', type: 'varchar', length: 120, nullable: true }) scanCode!: string | null
  @Column({ name: 'over_approved', type: 'tinyint', width: 1, default: 0 }) overApproved!: number
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('work_order_report', { engine: 'InnoDB' })
@Index('idx_work_order_report', ['tenantId', 'workOrderId'])
export class WorkOrderReportEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'work_order_id', type: 'bigint' }) workOrderId!: number
  @Column({ name: 'operation_id', type: 'bigint', nullable: true }) operationId!: number | null
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'defect_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) defectQty!: string
  @Column({ name: 'work_hours', type: 'decimal', precision: 10, scale: 2, default: 0 }) workHours!: string
  @Column({ name: 'scan_code', type: 'varchar', length: 120, nullable: true }) scanCode!: string | null
  @Column({ name: 'user_id', type: 'bigint' }) userId!: number
  @Column({ name: 'reported_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) reportedAt!: Date
}

@Entity('work_order_complete', { engine: 'InnoDB' })
@Index('idx_work_order_complete', ['tenantId', 'workOrderId'])
export class WorkOrderCompleteEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'work_order_id', type: 'bigint' }) workOrderId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'warehouse_id', type: 'bigint' }) warehouseId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'qc_result', type: 'varchar', length: 24, default: 'PENDING' }) qcResult!: string
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('mes_qc', { engine: 'InnoDB' })
@Index('idx_mes_qc', ['tenantId', 'bizType', 'bizId'])
export class QcEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'biz_type', type: 'varchar', length: 32 }) bizType!: string
  @Column({ name: 'biz_id', type: 'bigint' }) bizId!: number
  @Column({ name: 'inspection_type', type: 'varchar', length: 32 }) inspectionType!: string
  @Column({ name: 'sample_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) sampleQty!: string
  @Column({ name: 'defect_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) defectQty!: string
  @Column({ type: 'varchar', length: 24 }) result!: string
  @Column({ name: 'inspector_id', type: 'bigint' }) inspectorId!: number
  @Column({ name: 'concession_by', type: 'bigint', nullable: true }) concessionBy!: number | null
  @Column({ name: 'concession_reason', type: 'varchar', length: 500, nullable: true }) concessionReason!: string | null
  @Column({ name: 'concession_at', type: 'datetime', nullable: true }) concessionAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('mes_equipment', { engine: 'InnoDB' })
@Index('uk_mes_equipment_code', ['tenantId', 'equipmentCode'], { unique: true })
export class EquipmentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'equipment_code', type: 'varchar', length: 50 }) equipmentCode!: string
  @Column({ name: 'equipment_name', type: 'varchar', length: 100 }) equipmentName!: string
  @Column({ name: 'work_center_id', type: 'bigint', nullable: true }) workCenterId!: number | null
  @Column({ type: 'varchar', length: 24, default: 'IDLE' }) status!: string
  @Column({ name: 'oee', type: 'decimal', precision: 5, scale: 2, default: 0 }) oee!: string
  @Column({ name: 'fault_status', type: 'varchar', length: 24, default: 'NORMAL' }) faultStatus!: string
  @Column({ name: 'maintenance_cycle_days', type: 'int', default: 30 }) maintenanceCycleDays!: number
  @Column({ name: 'last_maintenance', type: 'date', nullable: true }) lastMaintenance!: string | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('production_exception', { engine: 'InnoDB' })
@Index('idx_production_exception', ['tenantId', 'status'])
export class ProductionExceptionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'exception_no', type: 'varchar', length: 60 }) exceptionNo!: string
  @Column({ name: 'exception_type', type: 'varchar', length: 32 }) exceptionType!: string
  @Column({ name: 'work_order_id', type: 'bigint', nullable: true }) workOrderId!: number | null
  @Column({ name: 'reason', type: 'varchar', length: 500, nullable: true }) reason!: string | null
  @Column({ name: 'closed_note', type: 'varchar', length: 500, nullable: true }) closedNote!: string | null
  @Column({ name: 'stop_line_at', type: 'datetime', nullable: true }) stopLineAt!: Date | null
  @Column({ name: 'stop_line_end', type: 'datetime', nullable: true }) stopLineEnd!: Date | null
  @Column({ name: 'downtime_minutes', type: 'int', default: 0 }) downtimeMinutes!: number
  @Column({ name: 'delay_days', type: 'decimal', precision: 10, scale: 2, default: 0 }) delayDays!: string
  @Column({ name: 'impact_order_id', type: 'bigint', nullable: true }) impactOrderId!: number | null
  @Column({ type: 'varchar', length: 24, default: 'OPEN' }) status!: string
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
