import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  AllocateClaimDto, ApplyVoucherTemplateDto, ApproveClaimDto, ApproveProvisionDto, ConfirmBankMatchDto,
  CreateCashflowCalendarDto, CreateCashflowScenarioDto, CreateCollectionPlanDto, CreateExpenseClaimDto,
  CreateExpensePolicyDto, CreateVoucherAttachmentDto, CreateVoucherTemplateDto, OccupyBudgetDto, PayClaimDto,
  QueryFinExtensionDto, ReleaseBudgetDto, ReopenPeriodDto, RollingForecastDto, RunBankMatchDto,
  SimulateCashflowDto, SubmitProvisionDto, SuggestSubjectDto, ValidateVoucherDto
} from './finance-extension.dto'
import { FinanceExtensionService } from './finance-extension.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

@Controller('finance/extensions')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class FinanceExtensionController {
  constructor(private readonly service: FinanceExtensionService) {}

  /* 科目停用校验与辅助核算 */
  @Post('vouchers/validate') @RequirePerm('finance:voucher:validate')
  validateVoucher(@Body() dto: ValidateVoucherDto, @CurrentUser() user: JwtUser) {
    return this.service.validateVoucher(dto, user)
  }

  @Get('subjects/:id/usage') @RequirePerm('finance:subject:view')
  subjectUsage(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.subjectUsage(id, user)
  }

  /* 凭证模板与 AI 科目建议 */
  @Get('templates') @RequirePerm('finance:template:view')
  listTemplates(@Query() query: QueryFinExtensionDto, @CurrentUser() user: JwtUser) {
    return this.service.listTemplates(query, user)
  }

  @Post('templates') @RequirePerm('finance:template:create')
  createTemplate(@Body() dto: CreateVoucherTemplateDto, @CurrentUser() user: JwtUser) {
    return this.service.createTemplate(dto, user)
  }

  @Post('templates/:id/apply') @RequirePerm('finance:template:create')
  applyTemplate(@Param('id', ParseIntPipe) id: number, @Body() dto: ApplyVoucherTemplateDto, @CurrentUser() user: JwtUser) {
    return this.service.applyTemplate({ ...dto, templateId: id }, user)
  }

  @Get('vouchers/subject-suggestions') @RequirePerm('finance:voucher:validate')
  suggestSubject(@Query() query: SuggestSubjectDto, @CurrentUser() user: JwtUser) {
    return this.service.suggestSubject(query, user)
  }

  /* 凭证附件 */
  @Get('vouchers/:id/attachments') @RequirePerm('finance:voucher:view')
  listAttachments(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.listAttachments(id, user)
  }

  @Post('vouchers/attachments') @RequirePerm('finance:voucher:attach')
  addAttachment(@Body() dto: CreateVoucherAttachmentDto, @CurrentUser() user: JwtUser) {
    return this.service.addAttachment(dto, user)
  }

  /* 试算平衡与报表下钻 */
  @Get('trial-balance/analysis') @RequirePerm('finance:voucher:view')
  trialBalanceAnalysis(@Query() query: QueryFinExtensionDto, @CurrentUser() user: JwtUser) {
    return this.service.trialBalanceAnalysis(query, user)
  }

  @Get('statements/compare') @RequirePerm('finance:report:view')
  statementComparison(@Query() query: QueryFinExtensionDto, @CurrentUser() user: JwtUser) {
    return this.service.statementComparison(query, user)
  }

  /* 收支 OCR 与费用政策 */
  @Post('expense/ocr') @RequirePerm('finance:expense:ocr')
  ocrReceipt(@Body() body: { text: string }, @CurrentUser() user: JwtUser) {
    void user
    return this.service.ocrReceipt(body?.text ?? '')
  }

  @Get('expense/policies') @RequirePerm('finance:expense:view')
  listPolicies(@Query() query: QueryFinExtensionDto, @CurrentUser() user: JwtUser) {
    return this.service.listPolicies(query, user)
  }

  @Post('expense/policies') @RequirePerm('finance:expense:create')
  createPolicy(@Body() dto: CreateExpensePolicyDto, @CurrentUser() user: JwtUser) {
    return this.service.createPolicy(dto, user)
  }

  @Get('expense/claims') @RequirePerm('finance:expense:view')
  listClaims(@Query() query: QueryFinExtensionDto, @CurrentUser() user: JwtUser) {
    return this.service.listClaims(query, user)
  }

  @Post('expense/claims') @RequirePerm('finance:expense:create')
  createClaim(@Body() dto: CreateExpenseClaimDto, @CurrentUser() user: JwtUser) {
    return this.service.createClaim(dto, user)
  }

  /** 报销审批 */
  @Post('expense/claims/:id/approve') @RequirePerm('finance:expense:approve')
  approveClaim(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveClaimDto, @CurrentUser() user: JwtUser) {
    return this.service.approveClaim(id, dto, user)
  }

  /** 报销部门分摊 */
  @Post('expense/claims/:id/allocate') @RequirePerm('finance:expense:approve')
  allocateClaim(@Param('id', ParseIntPipe) id: number, @Body() dto: AllocateClaimDto, @CurrentUser() user: JwtUser) {
    return this.service.allocateClaim(id, dto, user)
  }

  /** 报销付款联动 */
  @Post('expense/claims/:id/pay') @RequirePerm('finance:expense:pay')
  payClaim(@Param('id', ParseIntPipe) id: number, @Body() dto: PayClaimDto, @CurrentUser() user: JwtUser) {
    return this.service.payClaim(id, dto, user)
  }

  /* 账龄催收与坏账计提 */
  @Get('aging/risk') @RequirePerm('finance:collection:view')
  agingRisk(@Query() query: QueryFinExtensionDto, @CurrentUser() user: JwtUser) {
    return this.service.agingRisk(query, user)
  }

  @Get('collection-plans') @RequirePerm('finance:collection:view')
  listCollectionPlans(@Query() query: QueryFinExtensionDto, @CurrentUser() user: JwtUser) {
    return this.service.listCollectionPlans(query, user)
  }

  @Post('collection-plans') @RequirePerm('finance:collection:plan')
  createCollectionPlan(@Body() dto: CreateCollectionPlanDto, @CurrentUser() user: JwtUser) {
    return this.service.createCollectionPlan(dto, user)
  }

  @Get('provisions') @RequirePerm('finance:provision:view')
  listProvisions(@Query() query: QueryFinExtensionDto, @CurrentUser() user: JwtUser) {
    return this.service.listProvisions(query, user)
  }

  @Get('provisions/suggestion') @RequirePerm('finance:provision:view')
  suggestProvision(@Query('period') period: string, @CurrentUser() user: JwtUser) {
    return this.service.suggestProvision(period, user)
  }

  @Post('provisions') @RequirePerm('finance:provision:view')
  submitProvision(@Body() dto: SubmitProvisionDto, @CurrentUser() user: JwtUser) {
    return this.service.submitProvision(dto, user)
  }

  @Put('provisions/:id/approve') @RequirePerm('finance:provision:approve')
  approveProvision(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveProvisionDto, @CurrentUser() user: JwtUser) {
    return this.service.approveProvision(id, dto, user)
  }

  /* 银行流水自动匹配 */
  @Get('bank-matches') @RequirePerm('finance:bank-match:view')
  listBankMatches(@Query() query: QueryFinExtensionDto, @CurrentUser() user: JwtUser) {
    return this.service.listBankMatches(query, user)
  }

  @Post('bank-matches/run') @RequirePerm('finance:bank-match:run')
  runBankMatch(@Body() dto: RunBankMatchDto, @CurrentUser() user: JwtUser) {
    return this.service.runBankMatch(dto, user)
  }

  @Post('bank-matches/confirm') @RequirePerm('finance:bank-match:run')
  confirmBankMatch(@Body() dto: ConfirmBankMatchDto, @CurrentUser() user: JwtUser) {
    return this.service.confirmBankMatch(dto, user)
  }

  /* 现金流日历与情景模拟 */
  @Get('cashflow/scenarios') @RequirePerm('finance:cashflow:view')
  listCashflowScenarios(@Query() query: QueryFinExtensionDto, @CurrentUser() user: JwtUser) {
    return this.service.listCashflowScenarios(query, user)
  }

  @Post('cashflow/scenarios') @RequirePerm('finance:cashflow:simulate')
  createCashflowScenario(@Body() dto: CreateCashflowScenarioDto, @CurrentUser() user: JwtUser) {
    return this.service.createCashflowScenario(dto, user)
  }

  @Get('cashflow/calendar') @RequirePerm('finance:cashflow:view')
  cashflowCalendar(@Query() query: QueryFinExtensionDto, @CurrentUser() user: JwtUser) {
    return this.service.cashflowCalendar(query, user)
  }

  @Post('cashflow/calendar') @RequirePerm('finance:cashflow:simulate')
  createCashflowCalendar(@Body() dto: CreateCashflowCalendarDto, @CurrentUser() user: JwtUser) {
    return this.service.createCashflowCalendar(dto, user)
  }

  @Post('cashflow/simulate') @RequirePerm('finance:cashflow:simulate')
  simulateCashflow(@Body() dto: SimulateCashflowDto, @CurrentUser() user: JwtUser) {
    return this.service.simulateCashflow(dto, user)
  }

  /** 资金滚动预测 */
  @Post('cashflow/rolling-forecast') @RequirePerm('finance:cashflow:simulate')
  rollingForecast(@Body() dto: RollingForecastDto, @CurrentUser() user: JwtUser) {
    return this.service.rollingForecast(dto, user)
  }

  /* 成本重算任务回滚 */
  @Post('cost-jobs/:id/rollback') @RequirePerm('finance:cost:rollback')
  rollbackCostJob(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.rollbackCostJob(id, user)
  }

  /* 月结检查清单与反结账 */
  @Get('period-checks') @RequirePerm('finance:period:view')
  listPeriodChecks(@Query() query: QueryFinExtensionDto, @CurrentUser() user: JwtUser) {
    return this.service.listPeriodChecks(query, user)
  }

  @Post('period-checks/run') @RequirePerm('finance:period:check')
  runPeriodChecks(@Body('period') period: string, @CurrentUser() user: JwtUser) {
    return this.service.runPeriodChecks(period, user)
  }

  @Post('periods/reopen') @RequirePerm('finance:period:reopen')
  reopenPeriod(@Body() dto: ReopenPeriodDto, @CurrentUser() user: JwtUser) {
    return this.service.reopenPeriod(dto, user)
  }

  /* 预算编制控制占用 */
  @Get('budget-occupations') @RequirePerm('finance:budget:view')
  listBudgetOccupations(@Query() query: QueryFinExtensionDto, @CurrentUser() user: JwtUser) {
    return this.service.listBudgetOccupations(query, user)
  }

  @Post('budget-occupations') @RequirePerm('finance:budget:occupy')
  occupyBudget(@Body() dto: OccupyBudgetDto, @CurrentUser() user: JwtUser) {
    return this.service.occupyBudget(dto, user)
  }

  @Post('budget-occupations/release') @RequirePerm('finance:budget:occupy')
  releaseBudget(@Body() dto: ReleaseBudgetDto, @CurrentUser() user: JwtUser) {
    return this.service.releaseBudget(dto, user)
  }

  /* 财务仪表盘指标下钻 */
  @Get('dashboard') @RequirePerm('finance:report:view')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.service.dashboard(user)
  }
}
