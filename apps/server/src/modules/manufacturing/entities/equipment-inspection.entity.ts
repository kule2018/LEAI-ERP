import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('equipment_inspection', { engine: 'InnoDB' })
@Index('idx_equipment_inspection', ['tenantId', 'equipmentId'])
export class EquipmentInspectionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'equipment_id', type: 'bigint' }) equipmentId!: number
  @Column({ name: 'inspect_at', type: 'datetime', nullable: true }) inspectAt!: Date | null
  @Column({ name: 'availability', type: 'decimal', precision: 5, scale: 2, default: 0 }) availability!: string
  @Column({ name: 'performance_rate', type: 'decimal', precision: 5, scale: 2, default: 0 }) performanceRate!: string
  @Column({ name: 'quality_rate', type: 'decimal', precision: 5, scale: 2, default: 0 }) qualityRate!: string
  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 }) oee!: string
  @Column({ type: 'varchar', length: 24, default: 'NORMAL' }) result!: string
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
  @Column({ name: 'inspector_id', type: 'bigint', nullable: true }) inspectorId!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
