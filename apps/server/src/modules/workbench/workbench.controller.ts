import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import type { Scenario } from '../../common/workbench-engine'
import { AuthGuard } from '../../common/guards/auth.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { WorkbenchService } from './workbench.service'

@Controller('workbench')
@UseGuards(AuthGuard, PermissionsGuard)
export class WorkbenchController {
  constructor(private readonly service: WorkbenchService) {}

  @Get('kpis')
  @RequirePerm('dashboard:view')
  kpis(@CurrentUser() user: JwtUser) {
    return this.service.listKpis(user)
  }

  @Post('kpis')
  @RequirePerm('workbench:kpi:update')
  saveKpi(@Body() body: { code: string; name: string; source: string; roles?: string[]; sortNo?: number; enabled?: number }, @CurrentUser() user: JwtUser) {
    return this.service.saveKpi(body, user)
  }

  @Delete('kpis/:code')
  @RequirePerm('workbench:kpi:update')
  removeKpi(@Param('code') code: string, @CurrentUser() user: JwtUser) {
    return this.service.removeKpi(code, user)
  }

  @Get('overview')
  @RequirePerm('dashboard:view')
  overview(@CurrentUser() user: JwtUser) {
    return this.service.overview(user)
  }

  @Get('drill/:code')
  @RequirePerm('dashboard:view')
  drill(@Param('code') code: string, @CurrentUser() user: JwtUser) {
    return this.service.drill(code, user)
  }

  @Get('sales-trend')
  @RequirePerm('dashboard:view')
  salesTrend(@Query('year') year: string | undefined, @CurrentUser() user: JwtUser) {
    return this.service.salesTrend(year ? Number(year) : undefined, user)
  }

  @Get('cash-flow')
  @RequirePerm('dashboard:view')
  cashFlow(@Query('scenario') scenario: Scenario | undefined, @CurrentUser() user: JwtUser) {
    return this.service.cashFlow(scenario ? { scenario } : undefined, user)
  }

  @Get('subscriptions')
  @RequirePerm('dashboard:view')
  subscriptions(@CurrentUser() user: JwtUser) {
    return this.service.listSubscriptions(user)
  }

  @Post('subscriptions')
  @RequirePerm('workbench:subscription:update')
  saveSubscription(@Body() body: { resource: string; frequency?: string; channel?: string; enabled?: number }, @CurrentUser() user: JwtUser) {
    return this.service.saveSubscription(body, user)
  }

  @Post('subscriptions/dispatch')
  @RequirePerm('workbench:subscription:update')
  dispatchSubscriptions() {
    return this.service.dispatchDueSubscriptions()
  }

  @Delete('subscriptions/:id')
  @RequirePerm('workbench:subscription:update')
  removeSubscription(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeSubscription(id, user)
  }

  @Get('briefings')
  @RequirePerm('workbench:briefing:view')
  briefings(@Query() query: { page?: string; pageSize?: string; type?: string }, @CurrentUser() user: JwtUser) {
    return this.service.listBriefings({
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
      type: query.type
    }, user)
  }

  @Post('briefings')
  @RequirePerm('workbench:briefing:create')
  createBriefing(@Body() body: { type: 'WEEK' | 'MONTH'; template?: string; title?: string }, @CurrentUser() user: JwtUser) {
    return this.service.createBriefing(body, user)
  }

  @Get('briefings/:id/pdf')
  @RequirePerm('workbench:briefing:view')
  briefingPdf(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.briefingPdf(id, user)
  }

  @Post('briefings/:id/publish')
  @RequirePerm('workbench:briefing:publish')
  publishBriefing(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.publishBriefing(id, user)
  }

  @Post('briefings/:id/read')
  @RequirePerm('workbench:briefing:view')
  confirmRead(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.confirmRead(id, user)
  }
}
