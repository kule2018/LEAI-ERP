import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  CreateLaborContractDto, QueryLaborContractDto, RenewLaborContractDto, TerminateLaborContractDto
} from './hr-labor-contract.dto'
import { HrLaborContractService } from './hr-labor-contract.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

/** 劳动合同与到期提醒 */
@Controller('hr/contracts')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class HrLaborContractController {
  constructor(private readonly service: HrLaborContractService) {}

  @Get() @RequirePerm('hr:contract:view')
  list(@Query() query: QueryLaborContractDto, @CurrentUser() user: JwtUser) {
    return this.service.listContracts(query, user)
  }

  @Get('expiring') @RequirePerm('hr:contract:view')
  expiring(@Query() query: QueryLaborContractDto, @CurrentUser() user: JwtUser) {
    return this.service.expiringContracts(query, user)
  }

  @Post() @RequirePerm('hr:contract:create')
  create(@Body() dto: CreateLaborContractDto, @CurrentUser() user: JwtUser) {
    return this.service.createContract(dto, user)
  }

  @Post(':id/renew') @RequirePerm('hr:contract:renew')
  renew(@Param('id', ParseIntPipe) id: number, @Body() dto: RenewLaborContractDto, @CurrentUser() user: JwtUser) {
    return this.service.renewContract(id, dto, user)
  }

  @Post(':id/terminate') @RequirePerm('hr:contract:terminate')
  terminate(@Param('id', ParseIntPipe) id: number, @Body() dto: TerminateLaborContractDto, @CurrentUser() user: JwtUser) {
    return this.service.terminateContract(id, dto, user)
  }

  @Post('refresh-status') @RequirePerm('hr:contract:view')
  refresh(@CurrentUser() user: JwtUser) {
    return this.service.refreshExpiredStatus(user)
  }
}
