import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  AccrueCommissionDto,
  ApplyQuotationTemplateDto,
  AssignComplaintDto,
  CreateCreditFlowDto,
  CreateQuotationTemplateDto,
  CalculateCommissionDto,
  CompleteVisitDto,
  ConfirmCommissionDto,
  CreateComplaintDto,
  CreateCommissionRuleDto,
  CreateVisitDto,
  PlanVisitsDto,
  QueryCommissionRecordDto,
  QueryCommissionRuleDto,
  QueryComplaintDto,
  QueryReturnRateDto,
  QueryUnshippedDto,
  QueryVisitDto,
  ReopenComplaintDto,
  ResolveComplaintDto,
  UpdateCommissionRuleDto
} from './sales-crm-extension.dto'
import { SalesCrmExtensionService } from './sales-crm-extension.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

/** 销售佣金规则与佣金核算 */
@Controller('sales/commissions')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SalesCommissionController {
  constructor(private readonly service: SalesCrmExtensionService) {}

  @Get('rules') @RequirePerm('sales:commission:view')
  listRules(@Query() query: QueryCommissionRuleDto, @CurrentUser() user: JwtUser) {
    return this.service.listRules(query, user)
  }

  @Post('rules') @RequirePerm('sales:commission:manage')
  createRule(@Body() dto: CreateCommissionRuleDto, @CurrentUser() user: JwtUser) {
    return this.service.createRule(dto, user)
  }

  @Put('rules/:id') @RequirePerm('sales:commission:manage')
  updateRule(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCommissionRuleDto, @CurrentUser() user: JwtUser) {
    return this.service.updateRule(id, dto, user)
  }

  @Get('records') @RequirePerm('sales:commission:view')
  listRecords(@Query() query: QueryCommissionRecordDto, @CurrentUser() user: JwtUser) {
    return this.service.listRecords(query, user)
  }

  @Get('records/summary') @RequirePerm('sales:commission:view')
  summary(@Query('period') period: string | undefined, @CurrentUser() user: JwtUser) {
    return this.service.summarizeRecords(period, user)
  }

  @Get('preview') @RequirePerm('sales:commission:view')
  preview(
    @Query('ruleId', ParseIntPipe) ruleId: number,
    @Query('orderId', ParseIntPipe) orderId: number,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.previewCommission(ruleId, orderId, user)
  }

  @Post('accrue') @RequirePerm('sales:commission:calculate')
  accrue(@Body() dto: AccrueCommissionDto, @CurrentUser() user: JwtUser) {
    return this.service.accrueCommissions(dto, user)
  }

  @Post('calculate') @RequirePerm('sales:commission:calculate')
  calculate(@Body() dto: CalculateCommissionDto, @CurrentUser() user: JwtUser) {
    return this.service.calculateCommission(dto, user)
  }

  @Post('records/:id/confirm') @RequirePerm('sales:commission:confirm')
  confirm(@Param('id', ParseIntPipe) id: number, @Body() dto: ConfirmCommissionDto, @CurrentUser() user: JwtUser) {
    return this.service.confirmRecord(id, dto, user)
  }

  @Post('records/:id/pay') @RequirePerm('sales:commission:pay')
  pay(@Param('id', ParseIntPipe) id: number, @Body() dto: ConfirmCommissionDto, @CurrentUser() user: JwtUser) {
    return this.service.payRecord(id, dto, user)
  }

  @Post('records/:id/cancel') @RequirePerm('sales:commission:confirm')
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: ConfirmCommissionDto, @CurrentUser() user: JwtUser) {
    return this.service.cancelRecord(id, dto, user)
  }
}

/** 客户投诉工单 */
@Controller('sales/complaints')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SalesComplaintController {
  constructor(private readonly service: SalesCrmExtensionService) {}

  @Get() @RequirePerm('sales:complaint:view')
  list(@Query() query: QueryComplaintDto, @CurrentUser() user: JwtUser) {
    return this.service.listComplaints(query, user)
  }

  @Get(':id') @RequirePerm('sales:complaint:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.complaintDetail(id, user)
  }

  @Post() @RequirePerm('sales:complaint:create')
  create(@Body() dto: CreateComplaintDto, @CurrentUser() user: JwtUser) {
    return this.service.createComplaint(dto, user)
  }

  @Post(':id/assign') @RequirePerm('sales:complaint:handle')
  assign(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignComplaintDto, @CurrentUser() user: JwtUser) {
    return this.service.assignComplaint(id, dto, user)
  }

  @Post(':id/resolve') @RequirePerm('sales:complaint:handle')
  resolve(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolveComplaintDto, @CurrentUser() user: JwtUser) {
    return this.service.resolveComplaint(id, dto, user)
  }

  @Post(':id/close') @RequirePerm('sales:complaint:handle')
  close(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.closeComplaint(id, user)
  }

  /** 投诉工单重开 */
  @Post(':id/reopen') @RequirePerm('sales:complaint:handle')
  reopen(@Param('id', ParseIntPipe) id: number, @Body() dto: ReopenComplaintDto, @CurrentUser() user: JwtUser) {
    return this.service.reopenComplaint(id, dto, user)
  }
}

/** 客户回访 */
@Controller('sales/visits')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SalesVisitController {
  constructor(private readonly service: SalesCrmExtensionService) {}

  @Get() @RequirePerm('sales:visit:view')
  list(@Query() query: QueryVisitDto, @CurrentUser() user: JwtUser) {
    return this.service.listVisits(query, user)
  }

  @Post() @RequirePerm('sales:visit:create')
  create(@Body() dto: CreateVisitDto, @CurrentUser() user: JwtUser) {
    return this.service.createVisit(dto, user)
  }

  @Post(':id/plan') @RequirePerm('sales:visit:create')
  plan(@Param('id', ParseIntPipe) id: number, @Body('nextVisitAt') nextVisitAt: string, @CurrentUser() user: JwtUser) {
    return this.service.planVisit(id, nextVisitAt, user)
  }

  /** 批量生成回访计划 */
  @Post('plans') @RequirePerm('sales:visit:create')
  plans(@Body() dto: PlanVisitsDto, @CurrentUser() user: JwtUser) {
    return this.service.planVisits(dto, user)
  }

  /** 完成回访（登记满意度评分） */
  @Post(':id/complete') @RequirePerm('sales:visit:create')
  complete(@Param('id', ParseIntPipe) id: number, @Body() dto: CompleteVisitDto, @CurrentUser() user: JwtUser) {
    return this.service.completeVisit(id, dto, user)
  }

  /** 回访覆盖率统计 */
  @Get('summary') @RequirePerm('sales:visit:view')
  summary(@CurrentUser() user: JwtUser) {
    return this.service.visitSummary(user)
  }
}

/** 报价模板与信用流水 */
@Controller('sales/p1')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SalesP1Controller {
  constructor(private readonly service: SalesCrmExtensionService) {}

  @Get('quotation-templates') @RequirePerm('sales:quotation:view')
  templates(@CurrentUser() user: JwtUser) { return this.service.listQuotationTemplates(user) }
  @Post('quotation-templates') @RequirePerm('sales:quotation:create')
  createTemplate(@Body() dto: CreateQuotationTemplateDto, @CurrentUser() user: JwtUser) {
    return this.service.createQuotationTemplate(dto, user)
  }
  @Post('quotation-templates/apply') @RequirePerm('sales:quotation:view')
  applyTemplate(@Body() dto: ApplyQuotationTemplateDto, @CurrentUser() user: JwtUser) {
    return this.service.applyQuotationTemplate(dto, user)
  }

  @Get('credit-flows/:customerId') @RequirePerm('sales:order:view')
  creditFlows(@Param('customerId', ParseIntPipe) customerId: number, @CurrentUser() user: JwtUser) {
    return this.service.listCreditFlows(customerId, user)
  }
  @Post('credit-flows') @RequirePerm('sales:order:update')
  createCreditFlow(@Body() dto: CreateCreditFlowDto, @CurrentUser() user: JwtUser) {
    return this.service.createCreditFlow(dto, user)
  }
}

/** 销售未发货清单与退货率分析 */
@Controller('sales/reports')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SalesCrmReportController {
  constructor(private readonly service: SalesCrmExtensionService) {}

  @Get('unshipped') @RequirePerm('sales:report:view')
  unshipped(@Query() query: QueryUnshippedDto, @CurrentUser() user: JwtUser) {
    return this.service.unshippedList(query, user)
  }

  @Get('return-rate') @RequirePerm('sales:report:view')
  returnRate(@Query() query: QueryReturnRateDto, @CurrentUser() user: JwtUser) {
    return this.service.returnRate(query, user)
  }
}
