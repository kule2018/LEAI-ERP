import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_file', { engine: 'InnoDB' })
@Index('idx_sys_file_tenant_deleted', ['tenantId', 'isDeleted'])
export class FileEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string

  @Column({ name: 'object_key', type: 'varchar', length: 300 })
  objectKey!: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType!: string | null

  @Column({ name: 'size_bytes', type: 'bigint', default: 0 })
  sizeBytes!: number

  @Column({ name: 'storage_driver', type: 'varchar', length: 32, default: 'LOCAL' })
  storageDriver!: string

  @Column({ type: 'varchar', length: 500, nullable: true })
  url!: string | null

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
