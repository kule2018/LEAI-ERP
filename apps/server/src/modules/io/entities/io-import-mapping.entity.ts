import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 导入字段映射：把用户上传文件的列名映射到标准导入模板的表头 */
@Entity('io_import_mapping', { engine: 'InnoDB' })
@Index('idx_io_import_mapping', ['tenantId', 'code'])
export class IoImportMappingEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  /** 导入资源代码（customer / product 等） */
  @Column({ type: 'varchar', length: 50 })
  code!: string

  /** 上传文件中的原始列名 */
  @Column({ name: 'source_header', type: 'varchar', length: 120 })
  sourceHeader!: string

  /** 映射到的标准模板表头 */
  @Column({ name: 'target_header', type: 'varchar', length: 120 })
  targetHeader!: string

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date
}
