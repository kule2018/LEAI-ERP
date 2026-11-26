import { createHash, randomBytes } from 'node:crypto'
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import type { Redis } from 'ioredis'
import { Between, In, Repository } from 'typeorm'
import { DATA_SCOPE_LEVEL, type DataScopeLevel, type JwtUser, type MenuTreeItem } from '../../common/contracts'
import { comparePassword, DEFAULT_PASSWORD_POLICY, hashPassword, validatePasswordPolicy } from '../../common/utils/password.util'
import { buildRoleClosure, effectiveRoleIds } from '../../common/role-inherit-engine'
import { nextPermissionVersion, permissionVersionChanged } from '../../common/platform-guard-engine'
import { env } from '../../config/env'
import { generateTotpSecret, otpAuthUri, verifyTotp } from '../../common/security/totp'
import { AuditService } from '../audit/audit.service'
import { ConfigService } from '../config/config.service'
import { ChangePasswordDto, LoginDto, QueryLoginLogDto, RefreshDto, SsoCallbackDto } from './dto'
import { LoginLogEntity } from './entities/login-log.entity'
import { MenuEntity } from '../platform/entities/menu.entity'
import { PermissionEntity } from '../platform/entities/permission.entity'
import { RoleEntity } from '../platform/entities/role.entity'
import { RolePermissionEntity } from '../platform/entities/role-permission.entity'
import { TenantEntity } from '../platform/entities/tenant.entity'
import { UserEntity } from '../platform/entities/user.entity'
import { UserRoleEntity } from '../platform/entities/user-role.entity'

interface UserContext {
  roles: string[]
  permissions: string[]
  menus: MenuTreeItem[]
  dataScopeLevel: DataScopeLevel
  isSuperAdmin: boolean
}

interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: string
}

interface UserProfile {
  id: number
  tenantId: number
  username: string
  realName: string
  orgId: number | null
  roles: string[]
  permissions: string[]
  dataScopeLevel: DataScopeLevel
  isSuperAdmin: boolean
  mustChangePassword: boolean
}

export interface LoginMeta {
  ip?: string
  userAgent?: string
}

const SCOPE_RANK: Record<DataScopeLevel, number> = {
  SELF: 1,
  DEPT: 2,
  DEPT_AND_CHILD: 3,
  ORG: 4,
  ALL: 5
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(TenantEntity) private readonly tenantRepo: Repository<TenantEntity>,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity) private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity) private readonly permissionRepo: Repository<PermissionEntity>,
    @InjectRepository(MenuEntity) private readonly menuRepo: Repository<MenuEntity>,
    @InjectRepository(UserRoleEntity) private readonly userRoleRepo: Repository<UserRoleEntity>,
    @InjectRepository(RolePermissionEntity) private readonly rolePermissionRepo: Repository<RolePermissionEntity>,
    @InjectRepository(LoginLogEntity) private readonly loginLogRepo: Repository<LoginLogEntity>,
    private readonly jwtService: JwtService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService
  ) {}

  async login(dto: LoginDto, meta: LoginMeta = {}): Promise<TokenPair & { user: UserProfile; menus: MenuTreeItem[] }> {
    const tenantCode = dto.tenantCode?.trim() || 'default'
    const lockKey = `auth:lock:${tenantCode}:${dto.username}`
    const failKey = `auth:fail:${tenantCode}:${dto.username}`

    const tenant = await this.tenantRepo.findOne({ where: { tenantCode, isDeleted: 0 } })
    if (!tenant) {
      await this.registerLoginFailure(failKey, lockKey)
      await this.writeLoginLog({ tenantId: 0, username: dto.username, result: 'FAIL', reason: '租户不存在', meta })
      throw new UnauthorizedException('租户不存在')
    }

    const lockedTtl = await this.redis.ttl(lockKey)
    if (lockedTtl > 0) {
      await this.writeLoginLog({ tenantId: tenant.id, username: dto.username, result: 'LOCKED', reason: '账号处于锁定期', meta })
      throw new ForbiddenException(`登录已锁定，请 ${lockedTtl} 秒后重试`)
    }

    const user = await this.userRepo.findOne({
      where: { tenantId: tenant.id, username: dto.username, isDeleted: 0 }
    })
    if (!user || !comparePassword(dto.password, user.passwordHash)) {
      const attempts = await this.registerLoginFailure(failKey, lockKey)
      const locked = attempts >= 5
      await this.writeLoginLog({
        tenantId: tenant.id,
        userId: user?.id ?? null,
        username: dto.username,
        result: locked ? 'LOCKED' : 'FAIL',
        reason: locked ? '连续登录失败次数过多，账号锁定 15 分钟' : '账号或密码错误',
        meta
      })
      if (locked) throw new ForbiddenException('连续登录失败次数过多，账号锁定 15 分钟')
      throw new UnauthorizedException('账号或密码错误')
    }
    if (user.status !== 'ACTIVE') {
      await this.writeLoginLog({ tenantId: tenant.id, userId: user.id, username: dto.username, result: 'FAIL', reason: '账号已停用', meta })
      throw new ForbiddenException('账号已停用')
    }

    await this.assertLoginRisk(tenant.id, user.id, dto.username, dto, meta)
    await this.assertMfa(user, dto.mfaCode)

    const context = await this.loadUserContext(user)
    const tokens = await this.issueTokens(user, context)
    await this.redis.del(failKey, lockKey)
    await this.redis.set(`auth:token:${user.id}`, tokens.refreshToken, 'EX', env.jwt.refreshTtlSeconds)
    await this.writeLoginLog({ tenantId: tenant.id, userId: user.id, username: dto.username, result: 'SUCCESS', meta })
    await this.auditService.record({
      bizType: 'auth',
      bizId: user.id,
      action: 'LOGIN',
      afterValue: { username: dto.username, tenantCode, ip: meta.ip ?? null }
    }, {
      userId: user.id,
      tenantId: user.tenantId,
      username: user.username,
      realName: user.realName,
      orgId: user.orgId,
      roles: context.roles,
      permissions: [],
      isSuperAdmin: context.isSuperAdmin,
      dataScopeLevel: context.dataScopeLevel
    })

    return {
      ...tokens,
      user: this.toProfile(user, context),
      menus: context.menus
    }
  }

  private mfaConfigKey(userId: number): string {
    return `security.user.mfa.${userId}`
  }

  private async assertMfa(user: UserEntity, code?: string): Promise<void> {
    const config = await this.configService.getJson<{ secret?: string; enabled?: boolean }>(
      user.tenantId,
      this.mfaConfigKey(user.id),
      {}
    )
    if (!config.enabled || !config.secret) return
    if (!code || !verifyTotp(config.secret, code)) {
      await this.writeLoginLog({ tenantId: user.tenantId, userId: user.id, username: user.username, result: 'FAIL', reason: 'MFA 验证码无效' })
      throw new UnauthorizedException('MFA 验证码无效')
    }
  }

  /** 设备/IP 画像：记录指纹与网段，必要时要求验证码 */
  private async assertLoginRisk(
    tenantId: number,
    userId: number,
    username: string,
    dto: LoginDto,
    meta: LoginMeta
  ): Promise<void> {
    const ip = meta.ip ?? 'unknown'
    const prefix = ip.split('.').slice(0, 3).join('.') || 'unknown'
    const fingerprint = createHash('sha1').update(`${meta.userAgent ?? ''}|${prefix}`).digest('hex').slice(0, 24)
    const deviceKey = `auth:risk:device:${tenantId}:${username}`
    const ipKey = `auth:risk:ip:${tenantId}:${username}`
    const knownDevices = await this.redis.smembers(deviceKey)
    const lastPrefix = await this.redis.get(ipKey)
    const newDevice = !knownDevices.includes(fingerprint)
    const newLocation = Boolean(lastPrefix && lastPrefix !== prefix)

    await this.redis.sadd(deviceKey, fingerprint)
    await this.redis.expire(deviceKey, 30 * 86400)
    await this.redis.set(ipKey, prefix, 'EX', 30 * 86400)

    const captchaRequired = await this.configService.getBoolean(tenantId, 'security.login.captcha.enabled', false)
    if (!captchaRequired || (!newDevice && !newLocation)) return
    const answer = dto.captchaId ? await this.redis.get(`auth:captcha:${dto.captchaId}`) : null
    if (dto.captchaId) await this.redis.del(`auth:captcha:${dto.captchaId}`)
    if (!answer || answer !== dto.captchaAnswer) {
      await this.writeLoginLog({ tenantId, userId, username, result: 'FAIL', reason: '新设备或异地登录，验证码校验失败', meta })
      throw new ForbiddenException('检测到新设备或异地登录，请完成验证码校验')
    }
  }

  /** 生成一次性文本验证码（SVG），用于高风险登录二次校验 */
  async createCaptcha(): Promise<{ id: string; svg: string }> {
    const id = randomBytes(12).toString('hex')
    const answer = String(Math.floor(1000 + Math.random() * 9000))
    await this.redis.set(`auth:captcha:${id}`, answer, 'EX', env.security.captchaTtlSeconds)
    const chars = answer.split('').map((char, index) =>
      `<text x="${18 + index * 22}" y="34" font-size="24" fill="#1f2d3d" transform="rotate(${index % 2 === 0 ? -8 : 7} ${18 + index * 22} 34)">${char}</text>`
    ).join('')
    return { id, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="44"><rect width="112" height="44" fill="#eef2f7"/>${chars}</svg>` }
  }

  async setupMfa(user: JwtUser): Promise<{ secret: string; otpAuthUri: string }> {
    const secret = generateTotpSecret()
    await this.redis.set(`auth:mfa:pending:${user.tenantId}:${user.userId}`, secret, 'EX', 300)
    return { secret, otpAuthUri: otpAuthUri(secret, user.username, env.security.mfaIssuer) }
  }

  async verifyMfaSetup(user: JwtUser, code: string): Promise<{ enabled: boolean }> {
    const pending = await this.redis.get(`auth:mfa:pending:${user.tenantId}:${user.userId}`)
    if (!pending || !verifyTotp(pending, code)) throw new BadRequestException('MFA 验证码无效或已过期')
    await this.configService.upsert(user.tenantId, {
      configKey: this.mfaConfigKey(user.userId),
      configValue: JSON.stringify({ secret: pending, enabled: true }),
      valueType: 'JSON',
      category: 'SECURITY',
      remark: '用户 MFA 二次验证配置'
    }, user.userId)
    await this.redis.del(`auth:mfa:pending:${user.tenantId}:${user.userId}`)
    await this.auditService.record({ bizType: 'auth', bizId: user.userId, action: 'MFA_ENABLED' }, user)
    return { enabled: true }
  }

  async disableMfa(user: JwtUser, code: string): Promise<{ enabled: boolean }> {
    const config = await this.configService.getJson<{ secret?: string; enabled?: boolean }>(
      user.tenantId,
      this.mfaConfigKey(user.userId),
      {}
    )
    if (!config.secret || !verifyTotp(config.secret, code)) throw new BadRequestException('MFA 验证码无效')
    await this.configService.upsert(user.tenantId, {
      configKey: this.mfaConfigKey(user.userId),
      configValue: JSON.stringify({ secret: config.secret, enabled: false }),
      valueType: 'JSON',
      category: 'SECURITY'
    }, user.userId)
    await this.auditService.record({ bizType: 'auth', bizId: user.userId, action: 'MFA_DISABLED' }, user)
    return { enabled: false }
  }

  /** OIDC/SSO：生成授权地址并保存 state 防重放 */
  async ssoAuthorize(tenantCode = 'default'): Promise<{ url: string; state: string }> {
    const { ssoIssuer, ssoClientId, ssoCallbackUrl } = env.security
    if (!ssoIssuer || !ssoClientId || !ssoCallbackUrl) {
      throw new BadRequestException('SSO 未配置（SSO_ISSUER / SSO_CLIENT_ID / SSO_CALLBACK_URL）')
    }
    const state = randomBytes(16).toString('hex')
    await this.redis.set(`auth:sso:state:${state}`, tenantCode, 'EX', 600)
    const params = new URLSearchParams({
      client_id: ssoClientId,
      redirect_uri: ssoCallbackUrl,
      response_type: 'code',
      scope: 'openid profile email',
      state
    })
    return { url: `${ssoIssuer.replace(/\/$/, '')}/protocol/openid-connect/auth?${params.toString()}`, state }
  }

  /** OIDC/SSO：校验 state、换取令牌并按用户名映射本地账号 */
  async ssoCallback(dto: SsoCallbackDto): Promise<TokenPair & { user: UserProfile; menus: MenuTreeItem[] }> {
    const stateKey = `auth:sso:state:${dto.state}`
    const tenantCode = await this.redis.get(stateKey)
    if (!tenantCode) throw new BadRequestException('SSO state 无效或已过期')
    await this.redis.del(stateKey)
    const { ssoIssuer, ssoClientId, ssoClientSecret, ssoCallbackUrl } = env.security
    if (!ssoIssuer || !ssoClientId || !ssoClientSecret || !ssoCallbackUrl) {
      throw new BadRequestException('SSO 未配置')
    }
    const base = ssoIssuer.replace(/\/$/, '')
    const tokenUrl = env.security.ssoTokenUrl || `${base}/protocol/openid-connect/token`
    const userinfoUrl = env.security.ssoUserinfoUrl || `${base}/protocol/openid-connect/userinfo`
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: ssoClientId,
        client_secret: ssoClientSecret,
        redirect_uri: ssoCallbackUrl,
        code: dto.code
      }).toString()
    })
    if (!tokenResponse.ok) throw new UnauthorizedException('SSO 令牌交换失败')
    const tokenSet = await tokenResponse.json() as { access_token?: string }
    if (!tokenSet.access_token) throw new UnauthorizedException('SSO 未返回访问令牌')
    const userinfoResponse = await fetch(userinfoUrl, {
      headers: { authorization: `Bearer ${tokenSet.access_token}` }
    })
    if (!userinfoResponse.ok) throw new UnauthorizedException('SSO 用户信息获取失败')
    const userInfo = await userinfoResponse.json() as { preferred_username?: string; email?: string }
    const username = userInfo.preferred_username || userInfo.email?.split('@')[0]
    if (!username) throw new UnauthorizedException('SSO 用户缺少可用账号标识')
    const tenant = await this.tenantRepo.findOne({ where: { tenantCode, isDeleted: 0 } })
    if (!tenant) throw new UnauthorizedException('SSO 租户不存在')
    const user = await this.userRepo.findOne({ where: { tenantId: tenant.id, username, isDeleted: 0 } })
    if (!user || user.status !== 'ACTIVE') throw new ForbiddenException('SSO 用户未在本系统激活')
    const context = await this.loadUserContext(user)
    const tokens = await this.issueTokens(user, context)
    await this.redis.set(`auth:token:${user.id}`, tokens.refreshToken, 'EX', env.jwt.refreshTtlSeconds)
    await this.writeLoginLog({ tenantId: tenant.id, userId: user.id, username, result: 'SUCCESS', reason: 'SSO' })
    await this.auditService.record({ bizType: 'auth', bizId: user.id, action: 'SSO_LOGIN' }, {
      userId: user.id, tenantId: tenant.id, username, realName: user.realName, orgId: user.orgId,
      roles: context.roles, permissions: [], isSuperAdmin: context.isSuperAdmin, dataScopeLevel: context.dataScopeLevel
    })
    return { ...tokens, user: this.toProfile(user, context), menus: context.menus }
  }

  async refresh(dto: RefreshDto): Promise<TokenPair> {
    let payload: Record<string, unknown>
    try {
      payload = await this.jwtService.verifyAsync<Record<string, unknown>>(dto.refreshToken, {
        secret: env.jwt.secret
      })
    } catch {
      throw new UnauthorizedException('刷新令牌无效')
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('令牌类型不正确')
    }

    const userId = Number(payload.sub)
    const tenantId = Number(payload.tenantId)
    if (!Number.isFinite(userId) || !Number.isFinite(tenantId)) {
      throw new UnauthorizedException('刷新令牌数据不完整')
    }

    const stored = await this.redis.get(`auth:token:${userId}`)
    if (stored !== dto.refreshToken) {
      throw new UnauthorizedException('刷新令牌已失效')
    }

    // 权限版本校验：授权关系变更后旧令牌立即失效，需重新登录
    const currentVersion = await this.currentPermVersion(tenantId, userId)
    const tokenVersion = payload.permVersion === undefined ? undefined : Number(payload.permVersion)
    if (permissionVersionChanged(currentVersion, tokenVersion)) {
      throw new UnauthorizedException('权限已变更，请重新登录')
    }

    const user = await this.userRepo.findOne({ where: { id: userId, tenantId, isDeleted: 0 } })
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('账号不可继续使用')
    }

    const context = await this.loadUserContext(user)
    const tokens = await this.issueTokens(user, context)
    await this.redis.set(`auth:token:${user.id}`, tokens.refreshToken, 'EX', env.jwt.refreshTtlSeconds)
    return tokens
  }

  async logout(user: JwtUser): Promise<void> {
    await this.redis.del(`auth:token:${user.userId}`)
    // 提升权限版本，使已签发的访问令牌立即失效
    await this.bumpPermVersion(user.tenantId, user.userId)
  }

  /** 自助修改密码：校验旧密码与密码强度策略 */
  async changePassword(dto: ChangePasswordDto, user: JwtUser): Promise<{ changed: boolean }> {
    const entity = await this.userRepo.findOne({
      where: { id: user.userId, tenantId: user.tenantId, isDeleted: 0 }
    })
    if (!entity) throw new NotFoundException('用户不存在')
    if (!comparePassword(dto.oldPassword, entity.passwordHash)) {
      throw new ForbiddenException('原密码不正确')
    }
    if (comparePassword(dto.newPassword, entity.passwordHash)) {
      throw new ForbiddenException('新密码不能与原密码相同')
    }
    const policy = await this.resolvePasswordPolicy(user.tenantId)
    const errors = validatePasswordPolicy(dto.newPassword, policy)
    if (errors.length > 0) throw new ForbiddenException(errors.join('；'))

    entity.passwordHash = hashPassword(dto.newPassword)
    entity.passwordUpdatedAt = new Date()
    entity.mustChangePassword = 0
    entity.updatedAt = new Date()
    await this.userRepo.save(entity)
    await this.bumpPermVersion(user.tenantId, user.userId)
    await this.auditService.record({
      bizType: 'auth',
      bizId: entity.id,
      action: 'CHANGE_PASSWORD',
      afterValue: { username: entity.username }
    }, user)
    return { changed: true }
  }

  /** 登录日志分页查询 */
  async listLoginLogs(query: QueryLoginLogDto, user: JwtUser): Promise<{
    list: LoginLogEntity[]
    total: number
    page: number
    pageSize: number
  }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where: Record<string, unknown> = { tenantId: user.tenantId }
    if (query.username) where.username = query.username
    if (query.loginResult) where.loginResult = query.loginResult
    if (query.startDate) where.loginAt = await this.rangeFilter(query.startDate, query.endDate)
    const [list, total] = await this.loginLogRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return { list, total, page, pageSize }
  }

  /** 读取租户密码策略（可由系统参数覆盖） */
  private async resolvePasswordPolicy(tenantId: number): Promise<typeof DEFAULT_PASSWORD_POLICY> {
    const configured = await this.configService.getJson<Partial<typeof DEFAULT_PASSWORD_POLICY>>(
      tenantId,
      'security.password.policy',
      {}
    )
    return { ...DEFAULT_PASSWORD_POLICY, ...configured }
  }

  private async rangeFilter(startDate: string, endDate?: string): Promise<ReturnType<typeof Between>> {
    const start = new Date(startDate)
    const end = endDate ? new Date(endDate) : new Date(startDate)
    if (!endDate) {
      end.setHours(23, 59, 59, 999)
    }
    return Between(start, end)
  }

  /** 写入登录日志（失败不影响登录主流程） */
  private async writeLoginLog(params: {
    tenantId: number
    userId?: number | null
    username: string
    result: 'SUCCESS' | 'FAIL' | 'LOCKED'
    reason?: string
    meta?: LoginMeta
  }): Promise<void> {
    try {
      await this.loginLogRepo.save(this.loginLogRepo.create({
        tenantId: params.tenantId,
        userId: params.userId ?? null,
        username: params.username,
        loginIp: params.meta?.ip ?? null,
        loginResult: params.result,
        failReason: params.reason ?? null,
        userAgent: params.meta?.userAgent ? params.meta.userAgent.slice(0, 500) : null,
        loginAt: new Date()
      }))
    } catch {
      // 日志写入失败不阻断登录
    }
  }

  /** 读取用户权限版本（授权变更后自增，用于令牌即时失效） */
  async currentPermVersion(tenantId: number, userId: number): Promise<number> {
    const raw = await this.redis.get(this.permVersionKey(tenantId, userId))
    const parsed = Number(raw ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  /** 提升用户权限版本，使已签发令牌立即失效 */
  async bumpPermVersion(tenantId: number, userId: number): Promise<number> {
    const key = this.permVersionKey(tenantId, userId)
    const current = await this.currentPermVersion(tenantId, userId)
    const next = nextPermissionVersion(current)
    await this.redis.set(key, String(next))
    return next
  }

  private permVersionKey(tenantId: number, userId: number): string {
    return `auth:permver:${tenantId}:${userId}`
  }

  async profile(user: JwtUser): Promise<UserProfile> {
    const entity = await this.userRepo.findOne({
      where: { id: user.userId, tenantId: user.tenantId, isDeleted: 0 }
    })
    if (!entity) {
      throw new NotFoundException('用户不存在')
    }
    return this.toProfile(entity, await this.loadUserContext(entity))
  }

  async menus(user: JwtUser): Promise<MenuTreeItem[]> {
    const entity = await this.userRepo.findOne({
      where: { id: user.userId, tenantId: user.tenantId, isDeleted: 0 }
    })
    if (!entity) {
      throw new NotFoundException('用户不存在')
    }
    return (await this.loadUserContext(entity)).menus
  }

  private async registerLoginFailure(failKey: string, lockKey: string): Promise<number> {
    const attempts = await this.redis.incr(failKey)
    if (attempts === 1) {
      await this.redis.expire(failKey, 300)
    }
    if (attempts >= 5) {
      await this.redis.set(lockKey, '1', 'EX', 900)
      await this.redis.del(failKey)
    }
    return attempts
  }

  private async loadUserContext(user: UserEntity): Promise<UserContext> {
    const userRoles = await this.userRoleRepo.find({
      where: { tenantId: user.tenantId, userId: user.id }
    })
    const directRoleIds = userRoles.map((item) => item.roleId)
    const allRoles = await this.roleRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const closure = buildRoleClosure(allRoles)
    const effectiveIds = effectiveRoleIds(directRoleIds, closure)
    const roles = allRoles.filter((role) => effectiveIds.includes(role.id))

    const rolePermissions = effectiveIds.length > 0
      ? await this.rolePermissionRepo.find({ where: { tenantId: user.tenantId, roleId: In(effectiveIds) } })
      : []
    const permissionIds = rolePermissions.map((item) => item.permissionId)
    const permissions = permissionIds.length > 0
      ? await this.permissionRepo.find({ where: { id: In(permissionIds), isDeleted: 0 } })
      : []

    const roleNames = roles.map((role) => role.roleCode)
    const isSuperAdmin = roleNames.includes('SUPER_ADMIN')
    const permissionCodes = permissions.map((permission) => permission.permCode)
    if (isSuperAdmin && !permissionCodes.includes('*:*')) {
      permissionCodes.push('*:*')
    }

    const allMenus = await this.menuRepo.find({
      where: { tenantId: user.tenantId, isDeleted: 0 },
      order: { sortNo: 'ASC', id: 'ASC' }
    })
    const visibleMenus = isSuperAdmin
      ? allMenus
      : allMenus.filter((menu) => !menu.permCode || permissionCodes.includes(menu.permCode))

    return {
      roles: roleNames,
      permissions: [...new Set(permissionCodes)],
      menus: this.buildMenuTree(visibleMenus),
      dataScopeLevel: this.resolveDataScopeLevel(roles, isSuperAdmin),
      isSuperAdmin
    }
  }

  private resolveDataScopeLevel(roles: RoleEntity[], isSuperAdmin: boolean): DataScopeLevel {
    if (isSuperAdmin) {
      return DATA_SCOPE_LEVEL.ALL
    }
    return roles.reduce<DataScopeLevel>((current, role) => {
      const candidate = role.dataScopeLevel ?? DATA_SCOPE_LEVEL.SELF
      return SCOPE_RANK[candidate] > SCOPE_RANK[current] ? candidate : current
    }, DATA_SCOPE_LEVEL.SELF)
  }

  private buildMenuTree(menus: MenuEntity[]): MenuTreeItem[] {
    const nodeMap = new Map<number, MenuTreeItem>()
    for (const menu of menus) {
      nodeMap.set(menu.id, {
        id: menu.id,
        parentId: menu.parentId,
        title: menu.menuName,
        path: menu.routePath,
        component: menu.componentPath ?? '',
        icon: menu.icon ?? '',
        perm: menu.permCode ?? '',
        sortNo: menu.sortNo,
        hidden: menu.hidden === 1,
        children: []
      })
    }

    const roots: MenuTreeItem[] = []
    for (const node of nodeMap.values()) {
      const parent = node.parentId === null ? null : nodeMap.get(node.parentId)
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots.sort((left, right) => left.sortNo - right.sortNo)
  }

  private async issueTokens(user: UserEntity, context: UserContext): Promise<TokenPair> {
    const permVersion = await this.currentPermVersion(user.tenantId, user.id)
    await this.redis.set(
      `auth:perms:${user.tenantId}:${user.id}:${permVersion}`,
      JSON.stringify(context.permissions),
      'EX',
      env.jwt.refreshTtlSeconds
    )
    const payload = {
      sub: String(user.id),
      tenantId: user.tenantId,
      username: user.username,
      realName: user.realName,
      orgId: user.orgId,
      roles: context.roles,
      isSuperAdmin: context.isSuperAdmin,
      dataScopeLevel: context.dataScopeLevel,
      permVersion
    }
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: env.jwt.secret,
      expiresIn: env.jwt.accessTtl
    })
    const refreshToken = await this.jwtService.signAsync(
      { ...payload, type: 'refresh' },
      { secret: env.jwt.secret, expiresIn: env.jwt.refreshTtlSeconds }
    )
    return { accessToken, refreshToken, expiresIn: env.jwt.accessTtl }
  }

  private toProfile(user: UserEntity, context: UserContext): UserProfile {
    return {
      id: user.id,
      tenantId: user.tenantId,
      username: user.username,
      realName: user.realName,
      orgId: user.orgId,
      roles: context.roles,
      permissions: context.permissions,
      dataScopeLevel: context.dataScopeLevel,
      isSuperAdmin: context.isSuperAdmin,
      mustChangePassword: user.mustChangePassword === 1
    }
  }
}
