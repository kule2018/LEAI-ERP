import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import {
  BANK_CONNECTOR_LABEL, buildBankSyncPlan, maskConnectionCredentials,
  matchBankTransactions, parseBankStatement, validateBankConnection, type BankStatementRow
} from '../../common/bank-connection-rules'
import { AuditService } from '../audit/audit.service'
import { BankTransactionEntity } from './entities/bank-transaction.entity'
import { FinBankConnectionEntity } from './entities/finance-ledger.entity'
import { FinAccountEntity, FinPaymentEntity, FinReceiptEntity } from './entities/finance.entities'
import { CreateBankConnectionDto, QueryBankTransactionDto, SyncBankConnectionDto } from './dto'

/**
 * 银企直连服务：连接配置、流水同步与查询、账户余额同步
 */
@Injectable()
export class BankConnectionService {
  constructor(
    @InjectRepository(FinBankConnectionEntity) private readonly connectionRepo: Repository<FinBankConnectionEntity>,
    @InjectRepository(FinAccountEntity) private readonly accountRepo: Repository<FinAccountEntity>,
    @InjectRepository(BankTransactionEntity) private readonly bankTxRepo: Repository<BankTransactionEntity>,
    @InjectRepository(FinReceiptEntity) private readonly receiptRepo: Repository<FinReceiptEntity>,
    @InjectRepository(FinPaymentEntity) private readonly paymentRepo: Repository<FinPaymentEntity>,
    private readonly auditService: AuditService
  ) {}

  private num(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private money(value: number): string {
    return Number(this.num(value).toFixed(4)).toString()
  }

  /** 连接配置列表（凭证信息掩码） */
  async listConnections(user: JwtUser): Promise<Array<Record<string, unknown>>> {
    const list = await this.connectionRepo.find({ where: { tenantId: user.tenantId }, order: { id: 'DESC' } })
    return list.map((item) => ({
      id: item.id,
      accountId: item.accountId,
      bankName: item.bankName,
      accountNo: item.accountNo,
      connector: item.connector,
      connectorLabel: BANK_CONNECTOR_LABEL[item.connector as keyof typeof BANK_CONNECTOR_LABEL] ?? item.connector,
      credentials: maskConnectionCredentials(item.credentials),
      config: item.config,
      status: item.status,
      lastSyncAt: item.lastSyncAt,
      lastBalance: item.lastBalance,
      lastResult: item.lastResult,
      createdAt: item.createdAt
    }))
  }

  /** 新增连接配置 */
  async createConnection(dto: CreateBankConnectionDto, user: JwtUser): Promise<FinBankConnectionEntity> {
    const check = validateBankConnection({
      accountId: dto.accountId,
      bankName: dto.bankName,
      connector: dto.connector ?? 'MOCK'
    })
    if (!check.ok) throw new BadRequestException(check.reason ?? '连接参数不合法')
    const account = await this.accountRepo.findOne({ where: { id: dto.accountId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!account) throw new NotFoundException('资金账户不存在')
    const saved = await this.connectionRepo.save(this.connectionRepo.create({
      tenantId: user.tenantId,
      accountId: dto.accountId,
      bankName: dto.bankName,
      accountNo: dto.accountNo ?? null,
      connector: dto.connector ?? 'MOCK',
      credentials: dto.credentials ?? null,
      config: dto.config ?? null,
      status: 'ACTIVE',
      createdBy: user.userId
    }))
    await this.auditService.record({
      bizType: 'fin_bank_connection', bizId: saved.id, action: 'CREATE_BANK_CONNECTION',
      afterValue: { accountId: dto.accountId, connector: saved.connector }
    }, user)
    return saved
  }

  /** 更新连接配置（银行名、账号、适配器、启停状态） */
  async updateConnection(
    id: number,
    dto: Partial<CreateBankConnectionDto> & { status?: string },
    user: JwtUser
  ): Promise<FinBankConnectionEntity> {
    const connection = await this.connectionRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!connection) throw new NotFoundException('银行连接不存在')
    if (dto.bankName !== undefined) connection.bankName = dto.bankName
    if (dto.accountNo !== undefined) connection.accountNo = dto.accountNo
    if (dto.connector !== undefined) connection.connector = dto.connector
    if (dto.credentials !== undefined) connection.credentials = dto.credentials
    if (dto.config !== undefined) connection.config = dto.config
    if (dto.status !== undefined) connection.status = dto.status
    const saved = await this.connectionRepo.save(connection)
    await this.auditService.record({
      bizType: 'fin_bank_connection', bizId: id, action: 'UPDATE_BANK_CONNECTION',
      afterValue: { bankName: saved.bankName, connector: saved.connector, status: saved.status }
    }, user)
    return saved
  }

  /** 删除连接配置 */
  async removeConnection(id: number, user: JwtUser): Promise<void> {
    const connection = await this.connectionRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!connection) throw new NotFoundException('银行连接不存在')
    await this.connectionRepo.remove(connection)
    await this.auditService.record({
      bizType: 'fin_bank_connection', bizId: id, action: 'DELETE_BANK_CONNECTION', afterValue: {}
    }, user)
  }

  /**
   * 同步银行流水：按适配器拉取流水，去重后落库，并按流水推算期末余额
   */
  async syncConnection(id: number, dto: SyncBankConnectionDto, user: JwtUser): Promise<Record<string, unknown>> {
    const connection = await this.connectionRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!connection) throw new NotFoundException('银行连接不存在')
    if (connection.status !== 'ACTIVE') throw new BadRequestException('该银行连接已停用')
    const account = await this.accountRepo.findOne({ where: { id: connection.accountId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!account) throw new NotFoundException('资金账户不存在')

    const statements = this.fetchStatements(connection, account, dto)
    const existing = await this.bankTxRepo.find({ where: { tenantId: user.tenantId, accountId: connection.accountId } })
    const existingNos = new Set(existing.map((item) => item.externalNo))
    let imported = 0
    let skipped = 0
    const duplicates: string[] = []
    for (const row of statements.rows) {
      if (existingNos.has(row.externalNo)) {
        skipped++
        duplicates.push(row.externalNo)
        continue
      }
      await this.bankTxRepo.save(this.bankTxRepo.create({
        tenantId: user.tenantId,
        accountId: connection.accountId,
        externalNo: row.externalNo,
        direction: row.direction,
        amount: this.money(row.amount),
        txDate: row.txDate ?? null,
        summary: row.summary ?? null,
        createdBy: user.userId
      }))
      existingNos.add(row.externalNo)
      imported++
    }
    const plan = buildBankSyncPlan({
      transactions: statements.rows,
      bookBalance: this.num(account.balance)
    })
    connection.lastSyncAt = new Date()
    connection.lastBalance = this.money(plan.endingBalance)
    connection.lastResult = `导入 ${imported} 笔，跳过 ${skipped} 笔，收 ${plan.inflow} 支 ${plan.outflow}`
    await this.connectionRepo.save(connection)
    await this.auditService.record({
      bizType: 'fin_bank_connection', bizId: id, action: 'SYNC_BANK_CONNECTION',
      afterValue: { imported, skipped, inflow: plan.inflow, outflow: plan.outflow, endingBalance: plan.endingBalance }
    }, user)
    const reconcile = dto.reconcile ? await this.matchTransactions(id, user) : null
    return { connectionId: id, imported, skipped, duplicates, errors: statements.errors, plan, reconcile }
  }

  /** 流水对账：按金额/方向/日期/摘要匹配收付款单，写入匹配结果并返回差异清单 */
  async matchTransactions(connectionId: number, user: JwtUser): Promise<Record<string, unknown>> {
    const connection = await this.connectionRepo.findOne({ where: { id: connectionId, tenantId: user.tenantId } })
    if (!connection) throw new NotFoundException('银行连接不存在')
    const txs = await this.bankTxRepo.find({
      where: { tenantId: user.tenantId, accountId: connection.accountId, matched: 0 }
    })
    if (txs.length === 0) return { connectionId, matched: 0, summary: { unmatchedBankCount: 0, unmatchedBookCount: 0 } }
    const receipts = await this.receiptRepo.find({ where: { tenantId: user.tenantId, accountId: connection.accountId } })
    const payments = await this.paymentRepo.find({ where: { tenantId: user.tenantId, accountId: connection.accountId } })
    const types = new Map<number, string>()
    const candidates = [
      ...receipts.filter((item) => item.status !== 'REVERSED' && item.status !== 'RED').map((item) => {
        types.set(item.id, 'RECEIPT')
        return { id: item.id, direction: 'IN' as const, amount: this.num(item.amount), date: item.receivedAt ? String(item.receivedAt).slice(0, 10) : null, summary: item.receiptNo }
      }),
      ...payments.filter((item) => item.status !== 'REVERSED' && item.status !== 'RED').map((item) => {
        types.set(item.id, 'PAYMENT')
        return { id: item.id, direction: 'OUT' as const, amount: this.num(item.amount), date: item.paidAt ? String(item.paidAt).slice(0, 10) : null, summary: item.paymentNo }
      })
    ]
    const result = matchBankTransactions(
      txs.map((item) => ({
        id: item.id,
        direction: item.direction === 'OUT' ? 'OUT' as const : 'IN' as const,
        amount: this.num(item.amount),
        date: item.txDate,
        summary: item.summary
      })),
      candidates
    )
    for (const match of result.matches) {
      if (!match.matched || match.targetId === null) continue
      const tx = txs.find((item) => item.id === match.transactionId)
      if (!tx) continue
      tx.matched = 1
      tx.matchTargetType = types.get(match.targetId) ?? 'UNKNOWN'
      tx.matchTargetId = match.targetId
      tx.matchScore = String(match.score)
      tx.matchedAt = new Date()
      await this.bankTxRepo.save(tx)
    }
    await this.auditService.record({
      bizType: 'fin_bank_connection', bizId: connectionId, action: 'RECONCILE_BANK_TRANSACTIONS',
      afterValue: result.summary
    }, user)
    return { connectionId, ...result }
  }

  /** 同步银行余额：写入账户余额并记录连接最近余额 */
  async syncBalance(id: number, balance: number, user: JwtUser): Promise<Record<string, unknown>> {
    const connection = await this.connectionRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!connection) throw new NotFoundException('银行连接不存在')
    const account = await this.accountRepo.findOne({ where: { id: connection.accountId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!account) throw new NotFoundException('资金账户不存在')
    const bookBalance = this.num(account.balance)
    const bankBalance = this.num(balance)
    const plan = buildBankSyncPlan({ transactions: [], bookBalance, bankBalance })
    account.balance = this.money(bankBalance)
    await this.accountRepo.save(account)
    connection.lastBalance = this.money(bankBalance)
    connection.lastSyncAt = new Date()
    connection.lastResult = `余额同步：账面 ${bookBalance}，银行 ${bankBalance}`
    await this.connectionRepo.save(connection)
    await this.auditService.record({
      bizType: 'fin_bank_connection', bizId: id, action: 'SYNC_BANK_BALANCE',
      afterValue: { bookBalance, bankBalance, difference: plan.difference }
    }, user)
    return { accountId: account.id, balance: account.balance, difference: plan.difference, matched: plan.matched }
  }

  /** 银行流水查询 */
  async listTransactions(query: QueryBankTransactionDto, user: JwtUser): Promise<PageResult<BankTransactionEntity>> {
    const qb = this.bankTxRepo.createQueryBuilder('tx')
      .where('tx.tenantId = :tenantId', { tenantId: user.tenantId })
    if (query.accountId) qb.andWhere('tx.accountId = :accountId', { accountId: query.accountId })
    if (query.direction) qb.andWhere('tx.direction = :direction', { direction: query.direction })
    if (query.externalNo) qb.andWhere('tx.externalNo LIKE :externalNo', { externalNo: `%${query.externalNo}%` })
    if (query.beginDate) qb.andWhere('tx.txDate >= :beginDate', { beginDate: query.beginDate })
    if (query.endDate) qb.andWhere('tx.txDate <= :endDate', { endDate: query.endDate })
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const [list, total] = await qb
      .orderBy('tx.txDate', 'DESC')
      .addOrderBy('tx.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount()
    return buildPageResult(list, total, page, pageSize)
  }

  /** 按适配器注册表拉取并解析流水 */
  private fetchStatements(
    connection: FinBankConnectionEntity,
    account: FinAccountEntity,
    dto: SyncBankConnectionDto
  ): { rows: BankStatementRow[]; errors: string[] } {
    const content = dto.payload ?? dto.csvContent
    if (connection.connector !== 'MOCK' && !content) {
      throw new BadRequestException(`${BANK_CONNECTOR_LABEL[connection.connector as keyof typeof BANK_CONNECTOR_LABEL] ?? connection.connector}需要提供流水报文内容`)
    }
    return parseBankStatement(connection.connector, {
      content,
      accountNo: connection.accountNo ?? null,
      balance: this.num(account.balance),
      count: dto.count ?? 2,
      date: dto.date
    })
  }
}
