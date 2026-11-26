import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { CreateBackupPolicyDto, CreateRestoreDto, ExecuteBackupDto, QueryBackupDto, UpdateBackupPolicyDto } from './dto'
import { SystemBackupService } from './system-backup.service'

@Controller('system/backup')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'ORG' })
export class SystemBackupController {
  constructor(private readonly service: SystemBackupService) {}

  /** 备份策略列表 */
  @Get('policies') @RequirePerm('system:backup:view')
  policies(@CurrentUser() user: JwtUser) { return this.service.listPolicies(user) }

  /** 新增备份策略 */
  @Post('policies') @RequirePerm('system:backup:manage')
  createPolicy(@Body() dto: CreateBackupPolicyDto, @CurrentUser() user: JwtUser) { return this.service.createPolicy(dto, user) }

  /** 修改备份策略 */
  @Put('policies/:id') @RequirePerm('system:backup:manage')
  updatePolicy(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBackupPolicyDto, @CurrentUser() user: JwtUser) {
    return this.service.updatePolicy(id, dto, user)
  }

  /** 启用/停用备份策略 */
  @Post('policies/:id/toggle') @RequirePerm('system:backup:manage')
  togglePolicy(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.togglePolicy(id, user) }

  /** 备份执行记录 */
  @Get('records') @RequirePerm('system:backup:view')
  records(@Query() query: QueryBackupDto, @CurrentUser() user: JwtUser) { return this.service.listRecords(query, user) }

  /** 备份覆盖度统计 */
  @Get('summary') @RequirePerm('system:backup:view')
  summary(@CurrentUser() user: JwtUser) { return this.service.summary(user) }

  /** 立即执行一次备份 */
  @Post('execute') @RequirePerm('system:backup:execute')
  execute(@Body() dto: ExecuteBackupDto, @CurrentUser() user: JwtUser) { return this.service.execute(dto, user) }

  /** 恢复台账 */
  @Get('restores') @RequirePerm('system:backup:view')
  restores(@CurrentUser() user: JwtUser) { return this.service.listRestores(user) }

  /** 执行恢复（默认演练模式，真实恢复需二次确认） */
  @Post('restore') @RequirePerm('system:backup:restore')
  restore(@Body() dto: CreateRestoreDto, @CurrentUser() user: JwtUser) { return this.service.restore(dto, user) }

  /** 按保留期清理过期备份 */
  @Post('cleanup') @RequirePerm('system:backup:manage')
  cleanup(@CurrentUser() user: JwtUser) { return this.service.cleanup(user) }
}