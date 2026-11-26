import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common'
import { CurrentDataScope } from '../../common/decorators/current-data-scope.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { DataScopeInfo, JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { AuditService } from './audit.service'
import { QueryAuditDto, QueryAuditFieldLogDto } from './dto'

@Controller('system/audit')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'SELF' })
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @RequirePerm('system:audit:view')
  list(
    @Query() query: QueryAuditDto,
    @CurrentUser() user: JwtUser,
    @CurrentDataScope() scope: DataScopeInfo
  ) {
    return this.service.list(query, user, scope)
  }

  @Get('export')
  @RequirePerm('system:audit:view')
  @Header('content-type', 'text/csv; charset=utf-8')
  export(
    @Query() query: QueryAuditDto,
    @CurrentUser() user: JwtUser,
    @CurrentDataScope() scope: DataScopeInfo
  ) {
    return this.service.exportCsv(query, user, scope)
  }

  /** 字段级变更明细 */
  @Get('field-logs')
  @RequirePerm('system:audit:view')
  fieldLogs(
    @Query() query: QueryAuditFieldLogDto,
    @CurrentUser() user: JwtUser,
    @CurrentDataScope() scope: DataScopeInfo
  ) {
    return this.service.listFieldLogs(query, user, scope)
  }

  /** 字段级变更明细导出 */
  @Get('field-logs/export')
  @RequirePerm('system:audit:view')
  @Header('content-type', 'text/csv; charset=utf-8')
  exportFieldLogs(
    @Query() query: QueryAuditFieldLogDto,
    @CurrentUser() user: JwtUser,
    @CurrentDataScope() scope: DataScopeInfo
  ) {
    return this.service.exportFieldLogsCsv(query, user, scope)
  }
}
