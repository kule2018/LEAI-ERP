import { Body, Controller, Get, Header, Inject, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { DataSource } from 'typeorm'
import { Public } from '../../common/decorators/public.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { MetricsService } from './metrics.service'
import { ConfirmSecurityAlertDto, SecurityGuardService } from './security-guard.service'

@Controller()
export class OpsController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly metrics: MetricsService,
    private readonly securityGuard: SecurityGuardService
  ) {}

  @Public()
  @Get('health')
  async health(): Promise<Record<string, unknown>> {
    let database = 'DOWN'
    let redis = 'DOWN'
    try {
      await this.dataSource.query('SELECT 1')
      database = 'UP'
    } catch {
      database = 'DOWN'
    }
    try {
      const result = await this.redis.ping()
      redis = result === 'PONG' ? 'UP' : 'DOWN'
    } catch {
      redis = 'DOWN'
    }
    return {
      status: database === 'UP' && redis === 'UP' ? 'UP' : 'DEGRADED',
      database,
      redis,
      checkedAt: new Date().toISOString()
    }
  }

  @Public()
  @Get('metrics')
  getMetrics(): Record<string, unknown> {
    return this.metrics.snapshot()
  }

  @Get('metrics/slow')
  slowRequests() {
    return this.metrics.listSlowRequests()
  }

  @Get('metrics/alerts')
  alerts() {
    return this.metrics.alerts()
  }

  @Post('metrics/alerts/:type/ack')
  acknowledge(@Param('type') type: string) {
    return this.metrics.acknowledge(type)
  }

  @Public()
  @Get('metrics/prometheus')
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  async prometheus(): Promise<Buffer> {
    return Buffer.from(await this.metrics.prometheus(), 'utf8')
  }

  /* ---------------- 慢 SQL 采集 ---------------- */
  @Get('metrics/slow-sql')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePerm('ops:slowsql:view')
  slowSql(@Query('limit') limit?: string) {
    return this.securityGuard.listSlowSql(limit ? Number(limit) : 50)
  }

  @Get('metrics/slow-sql/history')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePerm('ops:slowsql:view')
  async slowSqlHistory(@Query('limit') limit?: string) {
    return this.securityGuard.listSlowSqlHistory(limit ? Number(limit) : 50)
  }

  @Post('metrics/slow-sql/persist')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePerm('ops:slowsql:view')
  async persistSlowSql(@CurrentUser() user: JwtUser) {
    const count = await this.securityGuard.persistSlowSql(user.tenantId)
    return { count }
  }

  /* ---------------- 越权访问告警 ---------------- */
  @Get('security/alerts')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePerm('ops:security:view')
  listAlerts(@Query() query: { page: number; pageSize: number; status?: string; level?: string }, @CurrentUser() user: JwtUser) {
    return this.securityGuard.listAlerts(query, user)
  }

  @Post('security/alerts/materialize')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePerm('ops:security:handle')
  async materializeAlerts(@CurrentUser() user: JwtUser) {
    const count = await this.securityGuard.materializeAlerts(user.tenantId)
    return { count }
  }

  @Put('security/alerts/:id/confirm')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePerm('ops:security:handle')
  confirmAlert(
    @Param('id') id: string,
    @Body() dto: ConfirmSecurityAlertDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.securityGuard.confirmAlert(Number(id), dto, user)
  }
}
