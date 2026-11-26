import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  CloseShiftDto,
  CreatePromotionBundleDto,
  OpenShiftDto,
  PreviewBundleDto,
  QuerySalesDto,
  StatementAnalysisDto,
  UpdatePromotionBundleDto
} from './dto'
import { SalesCounterService } from './sales-counter.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

/** POS 交接班 */
@Controller('sales/pos-shifts')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PosShiftController {
  constructor(private readonly service: SalesCounterService) {}

  @Get() @RequirePerm('sales:pos:shift')
  list(@Query() query: QuerySalesDto, @CurrentUser() user: JwtUser) { return this.service.listShifts(query, user) }

  @Get('current') @RequirePerm('sales:pos:shift')
  current(@CurrentUser() user: JwtUser) { return this.service.currentShift(user) }

  @Post('open') @RequirePerm('sales:pos:shift')
  open(@Body() dto: OpenShiftDto, @CurrentUser() user: JwtUser) { return this.service.openShift(dto, user) }

  @Post(':id/close') @RequirePerm('sales:pos:shift')
  close(@Param('id', ParseIntPipe) id: number, @Body() dto: CloseShiftDto, @CurrentUser() user: JwtUser) { return this.service.closeShift(id, dto, user) }

  @Post(':id/approve') @RequirePerm('sales:pos:shift:approve')
  approve(@Param('id', ParseIntPipe) id: number, @Body() body: { remark?: string }, @CurrentUser() user: JwtUser) {
    return this.service.approveShift(id, body?.remark ?? '', user)
  }
}

/** 组合促销（套装 / 满减） */
@Controller('sales/promotion-bundles')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PromotionBundleController {
  constructor(private readonly service: SalesCounterService) {}

  @Get() @RequirePerm('sales:promotion:bundle')
  list(@Query() query: QuerySalesDto, @CurrentUser() user: JwtUser) { return this.service.listBundles(query, user) }

  @Post() @RequirePerm('sales:promotion:bundle')
  create(@Body() dto: CreatePromotionBundleDto, @CurrentUser() user: JwtUser) { return this.service.createBundle(dto, user) }

  @Put(':id') @RequirePerm('sales:promotion:bundle')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePromotionBundleDto, @CurrentUser() user: JwtUser) { return this.service.updateBundle(id, dto, user) }

  @Post('preview') @RequirePerm('sales:promotion:bundle')
  preview(@Body() dto: PreviewBundleDto, @CurrentUser() user: JwtUser) { return this.service.previewBundle(dto, user) }
}

/** 客户对账差异分析与 AI 对账建议 */
@Controller('sales/statements')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class StatementAnalysisController {
  constructor(private readonly service: SalesCounterService) {}

  @Post('analysis') @RequirePerm('sales:statement:analysis')
  analyze(@Body() dto: StatementAnalysisDto, @CurrentUser() user: JwtUser) { return this.service.analyzeStatement(dto, user) }
}
