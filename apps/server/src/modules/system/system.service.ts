import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Redis } from 'ioredis'
import { nextPermissionVersion } from '../../common/platform-guard-engine'
import { In, Like, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { DEFAULT_PASSWORD_POLICY, hashPassword, validatePasswordPolicy } from '../../common/utils/password.util'
import { detectRoleConflict } from '../../common/role-inherit-engine'
import { detectPermissionConflicts, validateBatchGrant } from '../../common/permission-exclusion-rules'
import { AuditService } from '../audit/audit.service'
import { ConfigService } from '../config/config.service'
import { MenuEntity } from '../platform/entities/menu.entity'
import { PermissionEntity } from '../platform/entities/permission.entity'
import { RoleEntity } from '../platform/entities/role.entity'
import { RolePermissionEntity } from '../platform/entities/role-permission.entity'
import { UserEntity } from '../platform/entities/user.entity'
import { UserRoleEntity } from '../platform/entities/user-role.entity'
import {
  AssignPermissionsDto,
  AssignRolesDto,
  CreateCompanyDto,
  CreateDeptDto,
  CreateMenuDto,
  CreateOrgDto,
  CreatePermissionDto,
  CreatePositionDto,
  CreateRoleDto,
  CreateUserDto,
  QuerySystemDto,
  UpdateCompanyDto,
  UpdateDeptDto,
  UpdateMenuDto,
  UpdateOrgDto,
  UpdatePermissionDto,
  UpdatePositionDto,
  UpdateRoleDto,
  UpdateUserDto
} from './dto'
import { CompanyEntity, DeptEntity, OrgEntity, PositionEntity } from './entities/org.entities'

@Injectable()
export class SystemService {
  constructor(
    @InjectRepository(CompanyEntity) private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(OrgEntity) private readonly orgRepo: Repository<OrgEntity>,
    @InjectRepository(DeptEntity) private readonly deptRepo: Repository<DeptEntity>,
    @InjectRepository(PositionEntity) private readonly positionRepo: Repository<PositionEntity>,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity) private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity) private readonly permissionRepo: Repository<PermissionEntity>,
    @InjectRepository(MenuEntity) private readonly menuRepo: Repository<MenuEntity>,
    @InjectRepository(UserRoleEntity) private readonly userRoleRepo: Repository<UserRoleEntity>,
    private readonly configService: ConfigService,
    @InjectRepository(RolePermissionEntity) private readonly rolePermissionRepo: Repository<RolePermissionEntity>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly auditService: AuditService
  ) {}

  async listCompanies(query: QuerySystemDto, user: JwtUser): Promise<PageResult<CompanyEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { companyName: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.companyRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createCompany(dto: CreateCompanyDto, user: JwtUser): Promise<CompanyEntity> {
    const existing = await this.companyRepo.findOne({ where: { tenantId: user.tenantId, companyCode: dto.companyCode, isDeleted: 0 } })
    if (existing) throw new ConflictException('公司编码已存在')
    const saved = await this.companyRepo.save(this.companyRepo.create({ ...dto, tenantId: user.tenantId, status: dto.status ?? 'ACTIVE' }))
    await this.record('sys_company', saved.id, 'CREATE_COMPANY', user, null, saved)
    return saved
  }

  async updateCompany(id: number, dto: UpdateCompanyDto, user: JwtUser): Promise<CompanyEntity> {
    const entity = await this.findCompany(id, user)
    const before = { ...entity }
    Object.assign(entity, dto)
    entity.updatedAt = new Date()
    const saved = await this.companyRepo.save(entity)
    await this.record('sys_company', id, 'UPDATE_COMPANY', user, before, saved)
    return saved
  }

  async removeCompany(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findCompany(id, user)
    entity.isDeleted = 1
    await this.companyRepo.save(entity)
    await this.record('sys_company', id, 'DELETE_COMPANY', user, entity, null)
  }

  async listOrgs(query: QuerySystemDto, user: JwtUser): Promise<PageResult<OrgEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { orgName: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.orgRepo.findAndCount({
      where,
      order: { sortNo: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createOrg(dto: CreateOrgDto, user: JwtUser): Promise<OrgEntity> {
    const existing = await this.orgRepo.findOne({ where: { tenantId: user.tenantId, orgCode: dto.orgCode, isDeleted: 0 } })
    if (existing) throw new ConflictException('组织编码已存在')
    if (dto.companyId && !(await this.findCompany(dto.companyId, user))) throw new NotFoundException('所属公司不存在')
    const saved = await this.orgRepo.save(this.orgRepo.create({
      ...dto,
      tenantId: user.tenantId,
      parentId: dto.parentId ?? null,
      orgType: dto.orgType ?? 'ORG',
      sortNo: dto.sortNo ?? 0,
      status: dto.status ?? 'ACTIVE'
    }))
    await this.record('sys_org', saved.id, 'CREATE_ORG', user, null, saved)
    return saved
  }

  async updateOrg(id: number, dto: UpdateOrgDto, user: JwtUser): Promise<OrgEntity> {
    const entity = await this.findOrg(id, user)
    const before = { ...entity }
    Object.assign(entity, dto)
    entity.updatedAt = new Date()
    const saved = await this.orgRepo.save(entity)
    await this.record('sys_org', id, 'UPDATE_ORG', user, before, saved)
    return saved
  }

  async removeOrg(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findOrg(id, user)
    entity.isDeleted = 1
    await this.orgRepo.save(entity)
    await this.record('sys_org', id, 'DELETE_ORG', user, entity, null)
  }

  async listDepts(query: QuerySystemDto, user: JwtUser): Promise<PageResult<DeptEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { deptName: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.deptRepo.findAndCount({
      where,
      order: { sortNo: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createDept(dto: CreateDeptDto, user: JwtUser): Promise<DeptEntity> {
    const existing = await this.deptRepo.findOne({ where: { tenantId: user.tenantId, deptCode: dto.deptCode, isDeleted: 0 } })
    if (existing) throw new ConflictException('部门编码已存在')
    const saved = await this.deptRepo.save(this.deptRepo.create({
      ...dto,
      tenantId: user.tenantId,
      parentId: dto.parentId ?? null,
      leaderUserId: dto.leaderUserId ?? null,
      sortNo: dto.sortNo ?? 0,
      status: dto.status ?? 'ACTIVE'
    }))
    await this.record('sys_dept', saved.id, 'CREATE_DEPT', user, null, saved)
    return saved
  }

  async updateDept(id: number, dto: UpdateDeptDto, user: JwtUser): Promise<DeptEntity> {
    const entity = await this.findDept(id, user)
    const before = { ...entity }
    Object.assign(entity, dto)
    entity.updatedAt = new Date()
    const saved = await this.deptRepo.save(entity)
    await this.record('sys_dept', id, 'UPDATE_DEPT', user, before, saved)
    return saved
  }

  async removeDept(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findDept(id, user)
    entity.isDeleted = 1
    await this.deptRepo.save(entity)
    await this.record('sys_dept', id, 'DELETE_DEPT', user, entity, null)
  }

  async listPositions(query: QuerySystemDto, user: JwtUser): Promise<PageResult<PositionEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { positionName: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.positionRepo.findAndCount({
      where,
      order: { sortNo: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createPosition(dto: CreatePositionDto, user: JwtUser): Promise<PositionEntity> {
    const existing = await this.positionRepo.findOne({ where: { tenantId: user.tenantId, positionCode: dto.positionCode, isDeleted: 0 } })
    if (existing) throw new ConflictException('岗位编码已存在')
    const saved = await this.positionRepo.save(this.positionRepo.create({
      ...dto,
      tenantId: user.tenantId,
      deptId: dto.deptId ?? null,
      grade: dto.grade ?? 'P1',
      sortNo: dto.sortNo ?? 0,
      status: dto.status ?? 'ACTIVE'
    }))
    await this.record('sys_position', saved.id, 'CREATE_POSITION', user, null, saved)
    return saved
  }

  async updatePosition(id: number, dto: UpdatePositionDto, user: JwtUser): Promise<PositionEntity> {
    const entity = await this.findPosition(id, user)
    const before = { ...entity }
    Object.assign(entity, dto)
    entity.updatedAt = new Date()
    const saved = await this.positionRepo.save(entity)
    await this.record('sys_position', id, 'UPDATE_POSITION', user, before, saved)
    return saved
  }

  async removePosition(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findPosition(id, user)
    entity.isDeleted = 1
    await this.positionRepo.save(entity)
    await this.record('sys_position', id, 'DELETE_POSITION', user, entity, null)
  }

  async listUsers(query: QuerySystemDto, user: JwtUser): Promise<PageResult<UserEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { username: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.userRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 校验密码强度（策略可由租户系统参数覆盖） */
  private async assertPasswordPolicy(password: string, tenantId: number): Promise<void> {
    const policy = await this.configService.getJson<Partial<typeof DEFAULT_PASSWORD_POLICY>>(
      tenantId,
      'security.password.policy',
      {}
    )
    const errors = validatePasswordPolicy(password, { ...DEFAULT_PASSWORD_POLICY, ...policy })
    if (errors.length > 0) throw new BadRequestException(errors.join('；'))
  }

  async createUser(dto: CreateUserDto, user: JwtUser): Promise<UserEntity> {
    const existing = await this.userRepo.findOne({ where: { tenantId: user.tenantId, username: dto.username, isDeleted: 0 } })
    if (existing) throw new ConflictException('用户名已存在')
    const { password, ...rest } = dto
    await this.assertPasswordPolicy(password, user.tenantId)
    const saved = await this.userRepo.save(this.userRepo.create({
      ...rest,
      tenantId: user.tenantId,
      passwordHash: hashPassword(password),
      passwordUpdatedAt: new Date(),
      mustChangePassword: dto.mustChangePassword ? 1 : 0,
      deptId: dto.deptId ?? null,
      orgId: dto.orgId ?? null,
      mobile: dto.mobile ?? null,
      status: dto.status ?? 'ACTIVE',
      createdBy: user.userId
    }))
    await this.record('sys_user', saved.id, 'CREATE_USER', user, null, { ...saved, passwordHash: '***' })
    return saved
  }

  async updateUser(id: number, dto: UpdateUserDto, user: JwtUser): Promise<UserEntity> {
    const entity = await this.findUser(id, user)
    const before = { ...entity }
    const { password, ...rest } = dto
    if (password) {
      await this.assertPasswordPolicy(password, user.tenantId)
      entity.passwordHash = hashPassword(password)
      entity.passwordUpdatedAt = new Date()
      entity.mustChangePassword = dto.mustChangePassword ? 1 : 0
    }
    Object.assign(entity, rest)
    entity.updatedBy = user.userId
    entity.updatedAt = new Date()
    const saved = await this.userRepo.save(entity)
    await this.record('sys_user', id, 'UPDATE_USER', user, { ...before, passwordHash: '***' }, { ...saved, passwordHash: '***' })
    return saved
  }

  async removeUser(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findUser(id, user)
    entity.isDeleted = 1
    entity.status = 'DISABLED'
    await this.userRepo.save(entity)
    await this.userRoleRepo.delete({ tenantId: user.tenantId, userId: id })
    await this.record('sys_user', id, 'DELETE_USER', user, entity, null)
  }

  async assignUserRoles(userId: number, dto: AssignRolesDto, user: JwtUser): Promise<void> {
    await this.findUser(userId, user)
    if (dto.roleIds.length) {
      const roles = await this.roleRepo.find({ where: { id: In(dto.roleIds), tenantId: user.tenantId, isDeleted: 0 } })
      if (roles.length !== new Set(dto.roleIds).size) throw new NotFoundException('部分角色不存在')
    }
    await this.userRoleRepo.delete({ tenantId: user.tenantId, userId })
    for (const roleId of new Set(dto.roleIds)) {
      await this.userRoleRepo.save(this.userRoleRepo.create({ tenantId: user.tenantId, userId, roleId }))
    }
    await this.record('sys_user', userId, 'ASSIGN_ROLES', user, null, { roleIds: dto.roleIds })
    // 授权关系变更：提升权限版本，使该用户已签发令牌立即失效
    await this.bumpPermVersion(user.tenantId, [userId])
  }

  /** 提升受影响用户的权限版本（令牌即时失效） */
  private async bumpPermVersion(tenantId: number, userIds: number[]): Promise<void> {
    if (!userIds.length) return
    for (const userId of userIds) {
      const key = `auth:permver:${tenantId}:${userId}`
      const current = Number((await this.redis.get(key)) ?? 0)
      const next = nextPermissionVersion(Number.isFinite(current) ? current : 0)
      await this.redis.set(key, String(next))
    }
  }

  async listRoles(query: QuerySystemDto, user: JwtUser): Promise<PageResult<RoleEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { roleName: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.roleRepo.findAndCount({
      where,
      order: { sortNo: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createRole(dto: CreateRoleDto, user: JwtUser): Promise<RoleEntity> {
    const existing = await this.roleRepo.findOne({ where: { tenantId: user.tenantId, roleCode: dto.roleCode, isDeleted: 0 } })
    if (existing) throw new ConflictException('角色编码已存在')
    if (dto.parentId) {
      const parent = await this.roleRepo.findOne({ where: { id: dto.parentId, tenantId: user.tenantId, isDeleted: 0 } })
      if (!parent) throw new NotFoundException('父角色不存在')
    }
    const saved = await this.roleRepo.save(this.roleRepo.create({
      ...dto,
      tenantId: user.tenantId,
      parentId: dto.parentId ?? null,
      dataScopeLevel: dto.dataScopeLevel ?? 'SELF',
      sortNo: dto.sortNo ?? 0,
      status: dto.status ?? 'ACTIVE'
    }))
    await this.record('sys_role', saved.id, 'CREATE_ROLE', user, null, saved)
    return saved
  }

  async updateRole(id: number, dto: UpdateRoleDto, user: JwtUser): Promise<RoleEntity> {
    const entity = await this.findRole(id, user)
    const before = { ...entity }
    if (dto.parentId !== undefined) {
      const roles = await this.roleRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
      const conflict = detectRoleConflict(id, dto.parentId, roles)
      if (conflict) throw new BadRequestException(conflict)
    }
    Object.assign(entity, dto)
    entity.updatedAt = new Date()
    const saved = await this.roleRepo.save(entity)
    await this.record('sys_role', id, 'UPDATE_ROLE', user, before, saved)
    return saved
  }

  async removeRole(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findRole(id, user)
    entity.isDeleted = 1
    await this.roleRepo.save(entity)
    await this.rolePermissionRepo.delete({ tenantId: user.tenantId, roleId: id })
    await this.userRoleRepo.delete({ tenantId: user.tenantId, roleId: id })
    await this.record('sys_role', id, 'DELETE_ROLE', user, entity, null)
  }

  async assignRolePermissions(roleId: number, dto: AssignPermissionsDto, user: JwtUser): Promise<void> {
    await this.findRole(roleId, user)
    if (dto.permissionIds.length) {
      const permissions = await this.permissionRepo.find({ where: { id: In(dto.permissionIds), tenantId: In([0, user.tenantId]), isDeleted: 0 } })
      if (permissions.length !== new Set(dto.permissionIds).size) throw new NotFoundException('部分权限不存在')
      const conflicts = detectPermissionConflicts(permissions.map((item) => item.permCode))
      if (conflicts.length > 0) {
        throw new BadRequestException(`权限互斥：${conflicts.map((item) => item.description).join('；')}`)
      }
    }
    await this.rolePermissionRepo.delete({ tenantId: user.tenantId, roleId })
    for (const permissionId of new Set(dto.permissionIds)) {
      await this.rolePermissionRepo.save(this.rolePermissionRepo.create({ tenantId: user.tenantId, roleId, permissionId }))
    }
    await this.record('sys_role', roleId, 'ASSIGN_PERMISSIONS', user, null, { permissionIds: dto.permissionIds })
    // 角色权限变更：所有绑定该角色的用户令牌立即失效
    const userRoles = await this.userRoleRepo.find({ where: { tenantId: user.tenantId, roleId } })
    await this.bumpPermVersion(user.tenantId, [...new Set(userRoles.map((item) => item.userId))])
  }

  /** 批量授权：跨多个角色/用户授予或回收权限，含互斥校验 */
  async batchGrant(dto: {
    userIds?: number[]
    roleIds?: number[]
    permissionIds: number[]
    action?: string
  }, user: JwtUser): Promise<{ affectedRoles: number; affectedUsers: number; conflicts: string[] }> {
    const check = validateBatchGrant({
      userIds: dto.userIds,
      roleIds: dto.roleIds,
      permissionIds: dto.permissionIds,
      action: (dto.action ?? 'GRANT') as 'GRANT'
    })
    if (!check.ok) throw new BadRequestException(check.reason)
    const permissions = await this.permissionRepo.find({
      where: { id: In(dto.permissionIds), tenantId: In([0, user.tenantId]), isDeleted: 0 }
    })
    if (permissions.length !== new Set(dto.permissionIds).size) throw new NotFoundException('部分权限不存在')
    const conflicts = detectPermissionConflicts(permissions.map((item) => item.permCode))
    if (conflicts.length > 0) throw new BadRequestException(`权限互斥：${conflicts.map((item) => item.description).join('；')}`)
    const action = dto.action ?? 'GRANT'
    let affectedRoles = 0
    let affectedUsers = 0
    for (const roleId of dto.roleIds ?? []) {
      await this.findRole(roleId, user)
      if (action === 'REVOKE') {
        await this.rolePermissionRepo.delete({ tenantId: user.tenantId, roleId, permissionId: In(dto.permissionIds) })
      } else {
        for (const permissionId of dto.permissionIds) {
          const existed = await this.rolePermissionRepo.findOne({ where: { tenantId: user.tenantId, roleId, permissionId } })
          if (!existed) await this.rolePermissionRepo.save(this.rolePermissionRepo.create({ tenantId: user.tenantId, roleId, permissionId }))
        }
      }
      affectedRoles++
      const userRoles = await this.userRoleRepo.find({ where: { tenantId: user.tenantId, roleId } })
      await this.bumpPermVersion(user.tenantId, [...new Set(userRoles.map((item) => item.userId))])
    }
    for (const userId of dto.userIds ?? []) {
      await this.findUser(userId, user)
      // 用户级授权通过追加角色实现：为每个权限创建隐含角色
      for (const permissionId of dto.permissionIds) {
        const perm = permissions.find((item) => item.id === permissionId)
        if (!perm) continue
        const roleCode = `U${userId}_P${permissionId}`
        let role = await this.roleRepo.findOne({ where: { tenantId: user.tenantId, roleCode, isDeleted: 0 } })
        if (!role) {
          role = await this.roleRepo.save(this.roleRepo.create({
            tenantId: user.tenantId,
            roleCode,
            roleName: `用户${userId}授权-${perm.permCode}`,
            dataScopeLevel: 'SELF',
            status: 'ACTIVE'
          }))
        }
        const grantedRoleId = role.id
        await this.rolePermissionRepo.save(this.rolePermissionRepo.create({ tenantId: user.tenantId, roleId: grantedRoleId, permissionId }))
        await this.userRoleRepo.save(this.userRoleRepo.create({ tenantId: user.tenantId, userId, roleId: grantedRoleId }))
      }
      affectedUsers++
      await this.bumpPermVersion(user.tenantId, [userId])
    }
    await this.record('sys_permission', 0, 'BATCH_GRANT', user, null, { ...dto, affectedRoles, affectedUsers })
    return { affectedRoles, affectedUsers, conflicts: conflicts.map((item) => item.groupCode) }
  }

  async listPermissions(query: QuerySystemDto, user: JwtUser): Promise<PageResult<PermissionEntity>> {
    const where = {
      tenantId: In([0, user.tenantId]),
      isDeleted: 0,
      ...(query.keyword ? { permCode: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.permissionRepo.findAndCount({
      where,
      order: { permCode: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createPermission(dto: CreatePermissionDto, user: JwtUser): Promise<PermissionEntity> {
    const existing = await this.permissionRepo.findOne({ where: { permCode: dto.permCode, isDeleted: 0 } })
    if (existing) throw new ConflictException('权限码已存在')
    const saved = await this.permissionRepo.save(this.permissionRepo.create({
      ...dto,
      tenantId: user.tenantId,
      parentId: dto.parentId ?? null,
      sortNo: dto.sortNo ?? 0
    }))
    await this.record('sys_permission', saved.id, 'CREATE_PERMISSION', user, null, saved)
    return saved
  }

  async updatePermission(id: number, dto: UpdatePermissionDto, user: JwtUser): Promise<PermissionEntity> {
    const entity = await this.findPermission(id, user)
    const before = { ...entity }
    Object.assign(entity, dto)
    entity.updatedAt = new Date()
    const saved = await this.permissionRepo.save(entity)
    await this.record('sys_permission', id, 'UPDATE_PERMISSION', user, before, saved)
    return saved
  }

  async removePermission(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findPermission(id, user)
    entity.isDeleted = 1
    await this.permissionRepo.save(entity)
    await this.record('sys_permission', id, 'DELETE_PERMISSION', user, entity, null)
  }

  async listMenus(query: QuerySystemDto, user: JwtUser): Promise<PageResult<MenuEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.keyword ? { menuName: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.menuRepo.findAndCount({
      where,
      order: { sortNo: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createMenu(dto: CreateMenuDto, user: JwtUser): Promise<MenuEntity> {
    const existing = await this.menuRepo.findOne({ where: { tenantId: user.tenantId, routePath: dto.routePath } })
    if (existing) throw new ConflictException('菜单路由已存在')
    const saved = await this.menuRepo.save(this.menuRepo.create({
      ...dto,
      tenantId: user.tenantId,
      parentId: dto.parentId ?? null,
      componentPath: dto.componentPath ?? null,
      icon: dto.icon ?? null,
      permCode: dto.permCode ?? null,
      sortNo: dto.sortNo ?? 0,
      hidden: dto.hidden === 'YES' ? 1 : 0
    }))
    await this.record('sys_menu', saved.id, 'CREATE_MENU', user, null, saved)
    return saved
  }

  async updateMenu(id: number, dto: UpdateMenuDto, user: JwtUser): Promise<MenuEntity> {
    const entity = await this.findMenu(id, user)
    const before = { ...entity }
    if (dto.hidden !== undefined) entity.hidden = dto.hidden === 'YES' ? 1 : 0
    const { hidden: _hidden, ...rest } = dto
    void _hidden
    Object.assign(entity, rest)
    const saved = await this.menuRepo.save(entity)
    await this.record('sys_menu', id, 'UPDATE_MENU', user, before, saved)
    return saved
  }

  async removeMenu(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findMenu(id, user)
    entity.isDeleted = 1
    await this.menuRepo.save(entity)
    await this.record('sys_menu', id, 'DELETE_MENU', user, entity, null)
  }

  private async record(
    bizType: string,
    bizId: number,
    action: string,
    user: JwtUser,
    before: unknown,
    after: unknown
  ): Promise<void> {
    await this.auditService.record({
      bizType,
      bizId,
      action,
      beforeValue: before as Record<string, unknown> | null,
      afterValue: after as Record<string, unknown> | null
    }, user)
  }

  private async findCompany(id: number, user: JwtUser): Promise<CompanyEntity> {
    const entity = await this.companyRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('公司不存在')
    return entity
  }

  private async findOrg(id: number, user: JwtUser): Promise<OrgEntity> {
    const entity = await this.orgRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('组织不存在')
    return entity
  }

  private async findDept(id: number, user: JwtUser): Promise<DeptEntity> {
    const entity = await this.deptRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('部门不存在')
    return entity
  }

  private async findPosition(id: number, user: JwtUser): Promise<PositionEntity> {
    const entity = await this.positionRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('岗位不存在')
    return entity
  }

  private async findUser(id: number, user: JwtUser): Promise<UserEntity> {
    const entity = await this.userRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('用户不存在')
    return entity
  }

  private async findRole(id: number, user: JwtUser): Promise<RoleEntity> {
    const entity = await this.roleRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('角色不存在')
    return entity
  }

  private async findPermission(id: number, user: JwtUser): Promise<PermissionEntity> {
    const entity = await this.permissionRepo.findOne({ where: { id, tenantId: In([0, user.tenantId]), isDeleted: 0 } })
    if (!entity) throw new NotFoundException('权限不存在')
    return entity
  }

  private async findMenu(id: number, user: JwtUser): Promise<MenuEntity> {
    const entity = await this.menuRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('菜单不存在')
    return entity
  }
}
