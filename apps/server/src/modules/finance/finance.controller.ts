import { Body, Controller, Delete, Get, Header, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  AccountTransferDto, AssetChangeDto, BuildTaxDeclarationDto, CarryForwardDto, ClosePeriodDto,
  CreateAccountDto, CreateAssetDto, CreateBankConnectionDto, CreateBudgetDto, CreateCategoryDto,
  CreateCostDto, CreateInvoiceDto, CreatePayableDto, CreatePaymentDto, CreateReceivableDto,
  CreateReceiptDto, CreateSubjectDto, CreateTaxCodeDto, CreateVoucherDto, MergeSubjectDto, QueryBankTransactionDto,
  QueryFinanceDto, QueryLedgerDto, RedLineDto, SetOpeningBalanceDto, SyncBankConnectionDto, UpdateSubjectDto,
  VoidVoucherDto
} from './dto'
import { FinanceService } from './finance.service'
import { CostRecalculationService } from './cost-recalculation.service'
import { BankConnectionService } from './bank-connection.service'
import { CostingService } from './costing.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

@Controller('finance/subjects')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SubjectController {
  constructor(private readonly service: FinanceService) {}
  @Get() @RequirePerm('finance:subject:view')
  list(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listSubjects(query, user) }
  @Post() @RequirePerm('finance:subject:create')
  create(@Body() dto: CreateSubjectDto, @CurrentUser() user: JwtUser) { return this.service.createSubject(dto, user) }
  /** 启用/停用科目（停用前校验余额） */
  @Put(':id') @RequirePerm('finance:subject:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSubjectDto, @CurrentUser() user: JwtUser) {
    return this.service.updateSubject(id, dto, user)
  }
  /** 科目合并 */
  @Post('merge') @RequirePerm('finance:subject:merge')
  merge(@Body() dto: MergeSubjectDto, @CurrentUser() user: JwtUser) { return this.service.mergeSubjects(dto, user) }
}

@Controller('finance/accounts')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class FinAccountController {
  constructor(private readonly service: FinanceService) {}
  @Get() @RequirePerm('finance:account:view')
  list(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listAccounts(query, user) }
  @Post() @RequirePerm('finance:account:create')
  create(@Body() dto: CreateAccountDto, @CurrentUser() user: JwtUser) { return this.service.createAccount(dto, user) }
  @Post(':id/reconcile') @RequirePerm('finance:account:update')
  reconcile(@Param('id', ParseIntPipe) id: number, @Body() body: { bankBalance: number; outstandingIncome: number; outstandingPayment: number }, @CurrentUser() user: JwtUser) {
    return this.service.reconcileAccount(id, body.bankBalance, body.outstandingIncome, body.outstandingPayment, user)
  }
  @Post(':id/transactions/import') @RequirePerm('finance:account:update')
  importTransactions(@Param('id', ParseIntPipe) id: number, @Body() body: { rows: Array<{ externalNo: string; direction: string; amount: string; txDate?: string; summary?: string }> }, @CurrentUser() user: JwtUser) {
    return this.service.importBankTransactions(id, body.rows, user)
  }
  @Post('transfer') @RequirePerm('finance:account:update')
  transfer(@Body() dto: AccountTransferDto, @CurrentUser() user: JwtUser) { return this.service.transferBetweenAccounts(dto, user) }
  @Get('transfers') @RequirePerm('finance:account:view')
  transfers(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listAccountTransfers(query, user) }
}

@Controller('finance/vouchers')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class VoucherController {
  constructor(private readonly service: FinanceService) {}
  @Get() @RequirePerm('finance:voucher:view')
  list(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listVouchers(query, user) }
  @Get(':id/detail') @RequirePerm('finance:voucher:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.voucherDetail(id, user) }
  @Post() @RequirePerm('finance:voucher:create')
  create(@Body() dto: CreateVoucherDto, @CurrentUser() user: JwtUser) { return this.service.createVoucher(dto, user) }
  @Post(':id/post') @RequirePerm('finance:voucher:post')
  post(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.postVoucher(id, user) }
  @Post(':id/reverse') @RequirePerm('finance:voucher:reverse')
  reverse(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.reverseVoucher(id, user) }
  @Post(':id/unpost') @RequirePerm('finance:voucher:reverse')
  unpost(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.unpostVoucher(id, user) }
  /** 作废草稿凭证 */
  @Post(':id/void') @RequirePerm('finance:voucher:void')
  void(@Param('id', ParseIntPipe) id: number, @Body() dto: VoidVoucherDto, @CurrentUser() user: JwtUser) {
    return this.service.voidVoucher(id, dto, user)
  }
}

@Controller('finance')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class FinanceQueryController {
  constructor(private readonly service: FinanceService) {}
  @Get('trial-balance') @RequirePerm('finance:report:view')
  trialBalance(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.trialBalance(query, user) }
  @Get('report/subject-balance') @RequirePerm('finance:report:view')
  subjectBalance(@Query() query: QueryLedgerDto, @CurrentUser() user: JwtUser) { return this.service.subjectBalance(query, user) }
  @Get('report/detail-ledger') @RequirePerm('finance:report:view')
  detailLedger(@Query() query: QueryLedgerDto, @CurrentUser() user: JwtUser) { return this.service.detailLedger(query, user) }
  @Get('statements') @RequirePerm('finance:report:view')
  statements(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.statements(query, user) }
  /** 正式现金流量表（经营/投资/筹资分类） */
  @Get('statements/cash-flow') @RequirePerm('finance:report:view')
  cashFlowStatement(@Query('period') period: string, @CurrentUser() user: JwtUser) {
    return this.service.cashFlowStatement(period || new Date().toISOString().slice(0, 7), user)
  }
  /** 出具正式现金流量表（固化快照并留痕） */
  @Post('statements/cash-flow/issue') @RequirePerm('finance:report:export')
  issueCashFlowReport(@Body() body: { period: string; remark?: string; reportType?: 'OFFICIAL' | 'PREVIEW' }, @CurrentUser() user: JwtUser) {
    return this.service.issueCashFlowReport(body.period, user, { remark: body.remark, reportType: body.reportType })
  }
  /** 现金流量表出具记录 */
  @Get('statements/cash-flow/reports') @RequirePerm('finance:report:view')
  cashFlowReports(@Query('period') period: string, @CurrentUser() user: JwtUser) {
    return this.service.listCashFlowReports({ period: period || undefined }, user)
  }
  /** 现金流量表出具详情 */
  @Get('statements/cash-flow/reports/:id') @RequirePerm('finance:report:view')
  cashFlowReport(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.getCashFlowReport(id, user)
  }
  /** 作废已出具的现金流量表 */
  @Post('statements/cash-flow/reports/:id/void') @RequirePerm('finance:report:export')
  voidCashFlowReport(@Param('id', ParseIntPipe) id: number, @Body() body: { reason: string }, @CurrentUser() user: JwtUser) {
    return this.service.voidCashFlowReport(id, body.reason, user)
  }
  /** 报表指标下钻：指标 → 科目余额 */
  @Get('report/drilldown/:key') @RequirePerm('finance:report:view')
  drilldown(
    @Param('key') key: string,
    @Query('period') period: string,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.statementDrilldown(key as never, period || new Date().toISOString().slice(0, 7), user)
  }
  /** 报表导出（带水印的 CSV） */
  @Get('report/export') @RequirePerm('finance:report:export')
  @Header('content-type', 'text/csv; charset=utf-8')
  async exportReport(
    @Query('type') type: string,
    @Query('period') period: string,
    @Query('subjectId') subjectId: string,
    @CurrentUser() user: JwtUser
  ): Promise<Buffer> {
    const result = await this.service.exportReportCsv({
      type,
      period: period || new Date().toISOString().slice(0, 7),
      subjectId: subjectId ? Number(subjectId) : undefined
    }, user)
    return Buffer.from(`\ufeff${result.content}`, 'utf8')
  }
  @Get('dashboard') @RequirePerm('finance:report:view')
  dashboard(@CurrentUser() user: JwtUser) { return this.service.dashboard(user) }
  @Get('aging/:type') @RequirePerm('finance:report:view')
  aging(@Param('type') type: string, @CurrentUser() user: JwtUser) {
    return this.service.aging(type === 'PAYABLE' ? 'PAYABLE' : 'RECEIVABLE', user)
  }
}

@Controller('finance/receivables')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ReceivableController {
  constructor(private readonly service: FinanceService) {}
  @Get() @RequirePerm('finance:receivable:view')
  list(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listReceivables(query, user) }
  @Post() @RequirePerm('finance:receivable:create')
  create(@Body() dto: CreateReceivableDto, @CurrentUser() user: JwtUser) { return this.service.createReceivable(dto, user) }
  /** 应收单红冲 */
  @Post(':id/reverse') @RequirePerm('finance:receivable:reverse')
  reverse(@Param('id', ParseIntPipe) id: number, @Body() dto: RedLineDto, @CurrentUser() user: JwtUser) {
    return this.service.reverseReceivable(id, dto, user)
  }
}

@Controller('finance/payables')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PayableController {
  constructor(private readonly service: FinanceService) {}
  @Get() @RequirePerm('finance:payable:view')
  list(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listPayables(query, user) }
  @Post() @RequirePerm('finance:payable:create')
  create(@Body() dto: CreatePayableDto, @CurrentUser() user: JwtUser) { return this.service.createPayable(dto, user) }
  /** 应付单红冲 */
  @Post(':id/reverse') @RequirePerm('finance:payable:reverse')
  reverse(@Param('id', ParseIntPipe) id: number, @Body() dto: RedLineDto, @CurrentUser() user: JwtUser) {
    return this.service.reversePayable(id, dto, user)
  }
}

@Controller('finance/receipts')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ReceiptController {
  constructor(private readonly service: FinanceService) {}
  @Get() @RequirePerm('finance:receipt:view')
  list(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listReceipts(query, user) }
  @Post() @RequirePerm('finance:receipt:create')
  create(@Body() dto: CreateReceiptDto, @CurrentUser() user: JwtUser) { return this.service.createReceipt(dto, user) }
  /** 收款单红冲：冲回账户余额并释放核销 */
  @Post(':id/reverse') @RequirePerm('finance:receipt:reverse')
  reverse(@Param('id', ParseIntPipe) id: number, @Body() dto: RedLineDto, @CurrentUser() user: JwtUser) {
    return this.service.reverseReceipt(id, dto, user)
  }
}

@Controller('finance/payments')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PaymentController {
  constructor(private readonly service: FinanceService) {}
  @Get() @RequirePerm('finance:payment:view')
  list(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listPayments(query, user) }
  @Post() @RequirePerm('finance:payment:create')
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: JwtUser) { return this.service.createPayment(dto, user) }
  /** 付款单红冲：冲回账户余额并释放核销 */
  @Post(':id/reverse') @RequirePerm('finance:payment:reverse')
  reverse(@Param('id', ParseIntPipe) id: number, @Body() dto: RedLineDto, @CurrentUser() user: JwtUser) {
    return this.service.reversePayment(id, dto, user)
  }
}

@Controller('finance/invoices')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class InvoiceController {
  constructor(private readonly service: FinanceService) {}
  @Get() @RequirePerm('finance:invoice:view')
  list(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listInvoices(query, user) }
  @Post() @RequirePerm('finance:invoice:create')
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: JwtUser) { return this.service.createInvoice(dto, user) }
  @Post(':id/match') @RequirePerm('finance:invoice:view')
  match(@Param('id', ParseIntPipe) id: number, @Body() body: { documentAmount: number }, @CurrentUser() user: JwtUser) {
    return this.service.matchInvoiceToDocument(id, body.documentAmount, user)
  }
}

@Controller('finance/tax')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class TaxController {
  constructor(private readonly service: FinanceService) {}
  /** 税码税率列表 */
  @Get('codes') @RequirePerm('finance:invoice:view')
  codes(@CurrentUser() user: JwtUser) { return this.service.listTaxCodes(user) }
  /** 新增税码 */
  @Post('codes') @RequirePerm('finance:invoice:create')
  createCode(@Body() dto: CreateTaxCodeDto, @CurrentUser() user: JwtUser) { return this.service.createTaxCode(dto, user) }
  /** 税务申报汇总 */
  @Post('declaration') @RequirePerm('finance:invoice:view')
  declaration(@Body() dto: BuildTaxDeclarationDto, @CurrentUser() user: JwtUser) {
    return this.service.buildTaxDeclaration(dto, user)
  }
  /** 价税分离试算 */
  @Post('calc') @RequirePerm('finance:invoice:view')
  calc(@Body() body: { amount: number; rate: number; inclusive?: boolean }) {
    return this.service.calcTax(body.amount, body.rate, body.inclusive === true)
  }
}

@Controller('finance/categories')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class FinanceCategoryController {
  constructor(private readonly service: FinanceService) {}
  @Get() @RequirePerm('finance:expense:view')
  list(@Query('categoryType') categoryType: string, @CurrentUser() user: JwtUser) {
    return this.service.listCategories(categoryType, user)
  }
  @Post() @RequirePerm('finance:expense:create')
  create(@Body() dto: CreateCategoryDto, @CurrentUser() user: JwtUser) { return this.service.createCategory(dto, user) }
}

@Controller('finance/assets')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class AssetController {
  constructor(private readonly service: FinanceService) {}
  @Get() @RequirePerm('finance:asset:view')
  list(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listAssets(query, user) }
  @Get('depreciations') @RequirePerm('finance:asset:view')
  depreciations(@Query() query: { period?: string; assetId?: number; page?: number; pageSize?: number }, @CurrentUser() user: JwtUser) {
    return this.service.listDepreciations(query, user)
  }
  @Post() @RequirePerm('finance:asset:create')
  create(@Body() dto: CreateAssetDto, @CurrentUser() user: JwtUser) { return this.service.createAsset(dto, user) }
  @Post('depreciation') @RequirePerm('finance:asset:depreciate')
  depreciation(@Body() body: { period: string; withVoucher?: boolean; expenseSubjectId?: number; accumulatedSubjectId?: number }, @CurrentUser() user: JwtUser) {
    return this.service.runDepreciation(body.period, user, {
      withVoucher: body.withVoucher,
      expenseSubjectId: body.expenseSubjectId,
      accumulatedSubjectId: body.accumulatedSubjectId
    })
  }
  @Post(':id/stocktake') @RequirePerm('finance:asset:update')
  stocktake(@Param('id', ParseIntPipe) id: number, @Body() body: { actualQuantity: number }, @CurrentUser() user: JwtUser) { return this.service.stocktakeAsset(id, body.actualQuantity, user) }
  @Post(':id/dispose') @RequirePerm('finance:asset:update')
  dispose(@Param('id', ParseIntPipe) id: number, @Body() body: { disposeAmount: number }, @CurrentUser() user: JwtUser) { return this.service.disposeAsset(id, body.disposeAmount, user) }
  @Post(':id/change') @RequirePerm('finance:asset:update')
  change(@Param('id', ParseIntPipe) id: number, @Body() dto: AssetChangeDto, @CurrentUser() user: JwtUser) { return this.service.changeAsset(id, dto, user) }
  @Get('changes') @RequirePerm('finance:asset:view')
  changes(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listAssetChanges(query, user) }
}

@Controller('finance/periods')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PeriodController {
  constructor(private readonly service: FinanceService) {}
  @Get() @RequirePerm('finance:period:view')
  list(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listPeriods(query, user) }
  @Post('close') @RequirePerm('finance:period:close')
  close(@Body() dto: ClosePeriodDto, @CurrentUser() user: JwtUser) { return this.service.closePeriod(dto, user) }
  @Get('checks/:period') @RequirePerm('finance:period:view')
  checks(@Param('period') period: string, @CurrentUser() user: JwtUser) { return this.service.closePeriodChecks(period, user) }
  @Post('carry') @RequirePerm('finance:period:carry')
  carry(@Body() dto: CarryForwardDto, @CurrentUser() user: JwtUser) { return this.service.carryForwardPeriod(dto, user) }
  @Get('carries') @RequirePerm('finance:period:view')
  carries(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listPeriodCarries(query, user) }
  /** 反结转：生成红字冲销凭证冲回已结转金额 */
  @Post('reverse-carry') @RequirePerm('finance:period:carry')
  reverseCarry(@Body() body: { period: string }, @CurrentUser() user: JwtUser) { return this.service.reverseCarryForward(body.period, user) }
  /** 期初余额录入 */
  @Post('opening-balances') @RequirePerm('finance:period:carry')
  setOpeningBalances(@Body() dto: SetOpeningBalanceDto, @CurrentUser() user: JwtUser) { return this.service.setOpeningBalances(dto, user) }
  /** 期初余额查询 */
  @Get('opening-balances') @RequirePerm('finance:period:view')
  openingBalances(@Query('period') period: string, @CurrentUser() user: JwtUser) { return this.service.listOpeningBalances(period, user) }
}

@Controller('finance/bank')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class BankConnectionController {
  constructor(private readonly service: BankConnectionService) {}
  /** 银行连接配置列表 */
  @Get('connections') @RequirePerm('finance:bank:view')
  connections(@CurrentUser() user: JwtUser) { return this.service.listConnections(user) }
  /** 新增银行连接 */
  @Post('connections') @RequirePerm('finance:bank:manage')
  createConnection(@Body() dto: CreateBankConnectionDto, @CurrentUser() user: JwtUser) { return this.service.createConnection(dto, user) }
  /** 更新银行连接 */
  @Put('connections/:id') @RequirePerm('finance:bank:manage')
  updateConnection(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateBankConnectionDto> & { status?: string }, @CurrentUser() user: JwtUser) {
    return this.service.updateConnection(id, dto, user)
  }
  /** 删除银行连接 */
  @Delete('connections/:id') @RequirePerm('finance:bank:manage')
  removeConnection(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.removeConnection(id, user) }
  /** 同步银行流水 */
  @Post('connections/:id/sync') @RequirePerm('finance:bank:sync')
  syncConnection(@Param('id', ParseIntPipe) id: number, @Body() dto: SyncBankConnectionDto, @CurrentUser() user: JwtUser) {
    return this.service.syncConnection(id, dto, user)
  }
  /** 同步银行余额 */
  @Post('connections/:id/sync-balance') @RequirePerm('finance:bank:sync')
  syncBalance(@Param('id', ParseIntPipe) id: number, @Body() body: { balance: number }, @CurrentUser() user: JwtUser) {
    return this.service.syncBalance(id, body.balance, user)
  }
  /** 流水对账：自动匹配收付款单并返回差异清单 */
  @Post('connections/:id/reconcile') @RequirePerm('finance:bank:sync')
  reconcile(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.matchTransactions(id, user)
  }
  /** 银行流水查询 */
  @Get('transactions') @RequirePerm('finance:bank:view')
  transactions(@Query() query: QueryBankTransactionDto, @CurrentUser() user: JwtUser) { return this.service.listTransactions(query, user) }
}

@Controller('finance/costing')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class CostingController {
  constructor(private readonly service: CostingService) {}
  /** 存货收发存（移动加权） */
  @Get('inventory-movement') @RequirePerm('finance:costing:view')
  inventoryMovement(@Query('period') period: string, @Query('subjectId') subjectId: string | undefined, @CurrentUser() user: JwtUser) {
    return this.service.buildPeriodCosting(period, subjectId ? Number(subjectId) : undefined, user)
  }
}

@Controller('finance/costs')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class CostController {
  constructor(
    private readonly service: FinanceService,
    private readonly recalculation: CostRecalculationService
  ) {}
  @Get() @RequirePerm('finance:cost:view')
  list(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listCosts(query, user) }
  @Post() @RequirePerm('finance:cost:create')
  create(@Body() dto: CreateCostDto, @CurrentUser() user: JwtUser) { return this.service.createCost(dto, user) }
  @Post('recalculate') @RequirePerm('finance:cost:create')
  recalculate(@Body() body: { period: string }, @CurrentUser() user: JwtUser) { return this.service.createCostJob(body.period, user) }
  @Get('jobs') @RequirePerm('finance:cost:view')
  jobs(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listCostJobs(query, user) }
  @Post('jobs/:id/transition') @RequirePerm('finance:cost:create')
  transition(@Param('id', ParseIntPipe) id: number, @Body() body: { status: string; errorMessage?: string }, @CurrentUser() user: JwtUser) {
    return this.service.transitionCostJob(id, body.status as never, user, body.errorMessage)
  }
  /** 执行成本重算任务（锁定期间 → 重算 → 回写 → 释放期间） */
  @Post('jobs/:id/execute') @RequirePerm('finance:cost:execute')
  executeJob(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.recalculation.execute(id, user)
  }
  /** 失败任务重试 */
  @Post('jobs/:id/retry') @RequirePerm('finance:cost:execute')
  retryJob(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.recalculation.retry(id, user)
  }
}

@Controller('finance/budgets')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class BudgetController {
  constructor(private readonly service: FinanceService) {}
  @Get() @RequirePerm('finance:budget:view')
  list(@Query() query: QueryFinanceDto, @CurrentUser() user: JwtUser) { return this.service.listBudgets(query, user) }
  @Post() @RequirePerm('finance:budget:create')
  create(@Body() dto: CreateBudgetDto, @CurrentUser() user: JwtUser) { return this.service.createBudget(dto, user) }
}
