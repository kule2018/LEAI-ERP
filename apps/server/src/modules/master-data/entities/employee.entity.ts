import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('employee', { engine: 'InnoDB' })
@Index('uk_employee_no', ['tenantId', 'employeeNo'], { unique: true })
export class EmployeeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'employee_no', type: 'varchar', length: 50 })
  employeeNo!: string

  @Column({ type: 'varchar', length: 64 })
  name!: string

  @Column({ name: 'dept_id', type: 'bigint', nullable: true })
  deptId!: number | null

  @Column({ name: 'position_id', type: 'bigint', nullable: true })
  positionId!: number | null

  @Column({ name: 'user_id', type: 'bigint', nullable: true })
  userId!: number | null

  @Column({ type: 'varchar', length: 30, nullable: true })
  mobile!: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  email!: string | null

  @Column({ name: 'hire_date', type: 'date', nullable: true })
  hireDate!: string | null

  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status!: string

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt!: Date | null

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
