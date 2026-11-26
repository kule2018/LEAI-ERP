import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { JwtUser } from '../../common/contracts'
import { buildInventoryMovementReport, type InventoryCostingItem } from '../../common/inventory-costing-rules'
import { AuditService } from '../audit/audit.service'
import { StockLedgerEntity } from '../inventory/entities/inventory.entities'
import { ProductEntity } from '../master-data/entities/product.entity'
import { FinInventoryCostingEntity } from './entities/finance-ledger.entity'
import { VoucherEntity, VoucherEntryEntity } from './entities/finance.entities'

/**
 * 存货成本服务：移动加权口径的存货收发存报表，并与存货科目余额对账
 */
@Injectable()
export class CostingService {
  constructor(
    @InjectRepository(FinInventoryCostingEntity) private readonly costingRepo: Repository<FinInventoryCostingEntity>,
    @InjectRepository(StockLedgerEntity) private readonly ledgerRepo: Repository<StockLedgerEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(VoucherEntity) private readonly voucherRepo: Repository<VoucherEntity>,
    @InjectRepository(VoucherEntryEntity) private readonly entryRepo: Repository<VoucherEntryEntity>,
    private readonly auditService: AuditService
  ) {}

  private num(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private money(value: number): string {
    return Number(this.num(value).toFixed(4)).toString()
  }

  /** 期间起止日期 */
  private periodRange(period: string): { start: Date; end: Date } {
    const [year, month] = period.split('-').map((item) => Number(item))
    const start = new Date(Date.UTC(year, month - 1, 1))
    const end = new Date(Date.UTC(year, month, 1))
    return { start, end }
  }

  /**
   * 生成指定期间的存货收发存（移动加权）：
   * 期初 = 期间开始前的库存流水累计，本期 = 期间内流水发生额。
   */
  async buildPeriodCosting(period: string, subjectId: number | undefined, user: JwtUser): Promise<Record<string, unknown>> {
    const { start, end } = this.periodRange(period)
    const ledgers = await this.ledgerRepo.find({ where: { tenantId: user.tenantId }, order: { occurredAt: 'ASC' } })
    const items = new Map<number, InventoryCostingItem>()
    const ensure = (productId: number): InventoryCostingItem => {
      const exist = items.get(productId)
      if (exist) return exist
      const created: InventoryCostingItem = {
        productId,
        productName: '',
        openingQty: 0,
        openingAmount: 0,
        inQty: 0,
        inAmount: 0,
        outQty: 0,
        outAmount: 0
      }
      items.set(productId, created)
      return created
    }
    for (const ledger of ledgers) {
      const occurred = new Date(ledger.occurredAt)
      const item = ensure(ledger.productId)
      const qtyIn = this.num(ledger.qtyIn)
      const qtyOut = this.num(ledger.qtyOut)
      const cost = this.num(ledger.cost)
      if (occurred < start) {
        item.openingQty = this.num(item.openingQty) + qtyIn - qtyOut
        item.openingAmount = this.num(item.openingAmount) + qtyIn * cost - qtyOut * cost
        continue
      }
      if (occurred >= end) continue
      item.inQty = this.num(item.inQty) + qtyIn
      item.inAmount = this.num(item.inAmount) + qtyIn * cost
      item.outQty = this.num(item.outQty) + qtyOut
      item.outAmount = this.num(item.outAmount) + qtyOut * cost
    }
    const products = await this.productRepo.find({ where: { tenantId: user.tenantId } })
    const productMap = new Map(products.map((item) => [item.id, item]))
    for (const item of items.values()) {
      item.productName = productMap.get(item.productId)?.productName ?? ''
    }
    const list = [...items.values()]

    // 存货科目期末余额（已过账凭证的借贷发生额）
    let subjectBalance: number | null = null
    if (subjectId) {
      const entries = await this.entryRepo.find({ where: { tenantId: user.tenantId, subjectId } })
      const vouchers = await this.voucherRepo.find({ where: { tenantId: user.tenantId } })
      const voucherMap = new Map(vouchers.map((item) => [item.id, item]))
      let balance = 0
      for (const entry of entries) {
        const voucher = voucherMap.get(entry.voucherId)
        if (!voucher || voucher.status !== 'POSTED') continue
        if (voucher.period > period) continue
        balance += this.num(entry.debit) - this.num(entry.credit)
      }
      subjectBalance = Number(balance.toFixed(4))
    }

    const report = buildInventoryMovementReport(list, subjectBalance)

    // 落库快照
    const existing = await this.costingRepo.find({ where: { tenantId: user.tenantId, period } })
    const existingMap = new Map(existing.map((row) => [row.productId, row]))
    for (const row of report.rows) {
      const current = existingMap.get(row.productId)
      const target = current ?? this.costingRepo.create({ tenantId: user.tenantId, period, productId: row.productId })
      target.productName = row.productName
      target.method = 'MOVING_WEIGHTED'
      target.openingQty = this.money(row.openingQty)
      target.openingAmount = this.money(row.openingAmount)
      target.inQty = this.money(row.inQty)
      target.inAmount = this.money(row.inAmount)
      target.outQty = this.money(row.outQty)
      target.outAmount = this.money(row.outAmount)
      target.closingQty = this.money(row.closingQty)
      target.closingAmount = this.money(row.closingAmount)
      target.createdBy = user.userId
      await this.costingRepo.save(target)
    }

    await this.auditService.record({
      bizType: 'fin_inventory_costing', bizId: 0, action: 'BUILD_INVENTORY_COSTING',
      afterValue: { period, products: report.rows.length, difference: report.difference }
    }, user)

    return { period, subjectId: subjectId ?? null, ...report }
  }
}
