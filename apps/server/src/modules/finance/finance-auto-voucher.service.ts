import { Injectable, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { JwtUser } from '../../common/contracts'
import { DomainEventBus, type DomainEvent } from '../events/domain-event.module'
import { AccountSubjectEntity, VoucherEntity } from './entities/finance.entities'
import { FinanceService } from './finance.service'

interface VoucherSpec {
  debit: string
  credit: string
  summary: string
}

/** 业务事件 → 自动分录科目。科目编码由 PlatformSeederService 初始化，租户可调整。 */
const VOUCHER_SPECS: Record<string, VoucherSpec> = {
  'sales.order.approved': { debit: '1122', credit: '6001', summary: '销售确认' },
  'finance.receipt.created': { debit: '1002', credit: '1122', summary: '收到货款' },
  'purchase.receipt.completed': { debit: '1405', credit: '2202', summary: '采购入库暂估' },
  'finance.payment.created': { debit: '2202', credit: '1002', summary: '支付货款' },
  'finance.cost.carrying': { debit: '6401', credit: '1405', summary: '销售成本结转' },
  'finance.claim.paid': { debit: '6602', credit: '1002', summary: '费用报销支付' }
}

@Injectable()
export class FinanceAutoVoucherSubscriber implements OnModuleInit {
  constructor(
    private readonly bus: DomainEventBus,
    private readonly financeService: FinanceService,
    @InjectRepository(AccountSubjectEntity) private readonly subjectRepo: Repository<AccountSubjectEntity>,
    @InjectRepository(VoucherEntity) private readonly voucherRepo: Repository<VoucherEntity>
  ) {}

  onModuleInit(): void {
    this.bus.subscribe((event) => this.handle(event))
  }

  private async handle(event: DomainEvent): Promise<void> {
    const spec = VOUCHER_SPECS[event.type]
    if (!spec) return
    const amount = Number(event.payload?.amount ?? 0)
    if (!Number.isFinite(amount) || amount <= 0) return

    const sourceType = event.type.toUpperCase().slice(0, 32)
    const existing = await this.voucherRepo.findOne({
      where: { tenantId: event.tenantId, sourceType, sourceId: event.bizId }
    })
    if (existing) return

    const subjects = await this.subjectRepo.find({ where: { tenantId: event.tenantId, isDeleted: 0 } })
    const byCode = new Map(subjects.map((item) => [item.subjectCode, item.id]))
    const debitId = byCode.get(spec.debit)
    const creditId = byCode.get(spec.credit)
    if (!debitId || !creditId) return

    const value = amount.toFixed(4)
    const voucherDate = event.occurredAt.toISOString().slice(0, 10)
    const user: JwtUser = {
      userId: event.userId,
      tenantId: event.tenantId,
      username: 'system',
      realName: '系统事件',
      orgId: null,
      roles: [],
      permissions: [],
      isSuperAdmin: false,
      dataScopeLevel: 'ALL'
    }
    const voucher = await this.financeService.createVoucher({
      voucherDate,
      period: voucherDate.slice(0, 7),
      sourceType,
      sourceId: event.bizId,
      entries: [
        { subjectId: debitId, summary: spec.summary, debit: value, credit: '0' },
        { subjectId: creditId, summary: spec.summary, debit: '0', credit: value }
      ],
      remark: `自动凭证：${event.type}`
    }, user)
    await this.financeService.postVoucher(voucher.id, user)
  }
}
