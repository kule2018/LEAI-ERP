import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_dict_item', { engine: 'InnoDB' })
@Index('uk_sys_dict_item', ['tenantId', 'dictType', 'itemCode'], { unique: true })
export class DictItemEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'dict_type', type: 'varchar', length: 50 })
  dictType!: string

  @Column({ name: 'item_code', type: 'varchar', length: 50 })
  itemCode!: string

  @Column({ name: 'item_label', type: 'varchar', length: 100 })
  itemLabel!: string

  @Column({ name: 'item_value', type: 'varchar', length: 200, nullable: true })
  itemValue!: string | null

  @Column({ name: 'sort_no', type: 'int', default: 0 })
  sortNo!: number

  @Column({ type: 'varchar', length: 24, default: 'ENABLED' })
  status!: string

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
