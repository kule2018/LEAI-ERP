import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_company', { engine: 'InnoDB' })
@Index('uk_sys_company_code', ['tenantId', 'companyCode'], { unique: true })
export class CompanyEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'company_code', type: 'varchar', length: 60 }) companyCode!: string
  @Column({ name: 'company_name', type: 'varchar', length: 150 }) companyName!: string
  @Column({ name: 'credit_code', type: 'varchar', length: 50, nullable: true }) creditCode!: string | null
  @Column({ name: 'legal_person', type: 'varchar', length: 60, nullable: true }) legalPerson!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('sys_org', { engine: 'InnoDB' })
@Index('uk_sys_org_code', ['tenantId', 'orgCode'], { unique: true })
export class OrgEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'company_id', type: 'bigint' }) companyId!: number
  @Column({ name: 'parent_id', type: 'bigint', nullable: true }) parentId!: number | null
  @Column({ name: 'org_code', type: 'varchar', length: 60 }) orgCode!: string
  @Column({ name: 'org_name', type: 'varchar', length: 150 }) orgName!: string
  @Column({ name: 'org_type', type: 'varchar', length: 24, default: 'ORG' }) orgType!: string
  @Column({ name: 'sort_no', type: 'int', default: 0 }) sortNo!: number
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('sys_dept', { engine: 'InnoDB' })
@Index('uk_sys_dept_code', ['tenantId', 'deptCode'], { unique: true })
export class DeptEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'org_id', type: 'bigint' }) orgId!: number
  @Column({ name: 'parent_id', type: 'bigint', nullable: true }) parentId!: number | null
  @Column({ name: 'dept_code', type: 'varchar', length: 60 }) deptCode!: string
  @Column({ name: 'dept_name', type: 'varchar', length: 150 }) deptName!: string
  @Column({ name: 'leader_user_id', type: 'bigint', nullable: true }) leaderUserId!: number | null
  @Column({ name: 'sort_no', type: 'int', default: 0 }) sortNo!: number
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('sys_position', { engine: 'InnoDB' })
@Index('uk_sys_position_code', ['tenantId', 'positionCode'], { unique: true })
export class PositionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'org_id', type: 'bigint' }) orgId!: number
  @Column({ name: 'dept_id', type: 'bigint', nullable: true }) deptId!: number | null
  @Column({ name: 'position_code', type: 'varchar', length: 60 }) positionCode!: string
  @Column({ name: 'position_name', type: 'varchar', length: 150 }) positionName!: string
  @Column({ type: 'varchar', length: 24, default: 'P1' }) grade!: string
  @Column({ name: 'sort_no', type: 'int', default: 0 }) sortNo!: number
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}
