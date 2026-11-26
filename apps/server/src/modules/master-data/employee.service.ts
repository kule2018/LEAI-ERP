import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Like, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { AuditService } from '../audit/audit.service'
import { CreateEmployeeDto, QueryEmployeeDto, UpdateEmployeeDto } from './dto'
import { EmployeeEntity } from './entities/employee.entity'

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(EmployeeEntity) private readonly repo: Repository<EmployeeEntity>,
    private readonly auditService: AuditService
  ) {}

  async list(query: QueryEmployeeDto, user: JwtUser): Promise<PageResult<EmployeeEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.keyword ? { name: Like(`%${query.keyword}%`) } : {}),
      ...(query.deptId ? { deptId: query.deptId } : {})
    }
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async create(dto: CreateEmployeeDto, user: JwtUser): Promise<EmployeeEntity> {
    const existing = await this.repo.findOne({ where: { tenantId: user.tenantId, employeeNo: dto.employeeNo, isDeleted: 0 } })
    if (existing) throw new ConflictException('员工工号已存在')
    const entity = this.repo.create({
      ...dto,
      tenantId: user.tenantId,
      deptId: dto.deptId ?? null,
      positionId: dto.positionId ?? null,
      userId: dto.userId ?? null,
      mobile: dto.mobile ?? null,
      email: dto.email ?? null,
      hireDate: dto.hireDate ?? null,
      createdBy: user.userId
    })
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'employee', bizId: saved.id, action: 'CREATE_EMPLOYEE', afterValue: saved }, user)
    return saved
  }

  async update(id: number, dto: UpdateEmployeeDto, user: JwtUser): Promise<EmployeeEntity> {
    const entity = await this.findOwned(id, user)
    const before = { ...entity }
    Object.assign(entity, dto)
    entity.updatedAt = new Date()
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'employee', bizId: id, action: 'UPDATE_EMPLOYEE', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async remove(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findOwned(id, user)
    entity.isDeleted = 1
    await this.repo.save(entity)
    await this.auditService.record({ bizType: 'employee', bizId: id, action: 'DELETE_EMPLOYEE', beforeValue: entity }, user)
  }

  private async findOwned(id: number, user: JwtUser): Promise<EmployeeEntity> {
    const entity = await this.repo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('员工不存在')
    return entity
  }
}
