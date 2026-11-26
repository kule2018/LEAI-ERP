import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 多语言语言包条目 */
@Entity('sys_lang', { engine: 'InnoDB' })
@Index('uk_sys_lang', ['tenantId', 'langCode', 'resourceKey'], { unique: true })
export class SystemLangEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'lang_code', type: 'varchar', length: 16 }) langCode!: string
  @Column({ name: 'locale_name', type: 'varchar', length: 60 }) localeName!: string
  @Column({ name: 'resource_key', type: 'varchar', length: 200 }) resourceKey!: string
  @Column({ name: 'resource_value', type: 'varchar', length: 500 }) resourceValue!: string
  @Column({ name: 'fallback_lang', type: 'varchar', length: 16, nullable: true }) fallbackLang!: string | null
  @Column({ type: 'varchar', length: 16, default: 'ENABLED' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)', onUpdate: 'CURRENT_TIMESTAMP(3)' }) updatedAt!: Date
}
