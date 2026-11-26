import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { AssignRiskDto, CloseRiskDto, QueryRiskDto } from './dto'
import { RiskService } from './risk.service'

@Controller('risk')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'ORG' })
export class RiskController {
  constructor(private readonly service: RiskService) {}

  @Get()
  @RequirePerm('risk:view')
  list(@Query() query: QueryRiskDto, @CurrentUser() user: JwtUser) {
    return this.service.list(query, user)
  }

  @Post('scan')
  @RequirePerm('risk:scan')
  scan(@CurrentUser() user: JwtUser) {
    return this.service.scan(user)
  }

  @Post(':id/assign')
  @RequirePerm('risk:assign')
  assign(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignRiskDto, @CurrentUser() user: JwtUser) {
    return this.service.assign(id, dto.assigneeId, user)
  }

  @Post(':id/close')
  @RequirePerm('risk:close')
  close(@Param('id', ParseIntPipe) id: number, @Body() dto: CloseRiskDto, @CurrentUser() user: JwtUser) {
    return this.service.close(id, dto.reason, user)
  }
}
