import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { JwtUser } from '../../common/contracts'
import { AuditService } from '../audit/audit.service'
import { PayableEntity, ReceivableEntity } from './entities/finance.entities'

@Injectable()
export class FinanceIntegrationService {
  constructor(
    @InjectRepository(ReceivableEntity) private readonly arRepo: Repository<ReceivableEntity>,
    @InjectRepository(PayableEntity) private readonly apRepo: Repository<PayableEntity>,
    private readonly auditService: AuditService
  ) {}

  async ensureSaleReceivable(
    input: { customerId: number; sourceId: number; sourceNo: string; amount: string; dueDate?: string | null },
    user: JwtUser
  ): Promise<ReceivableEntity> {
    const existing = await this.arRepo.findOne({
      where: { tenantId: user.tenantId, sourceType: 'SALE_ORDER', sourceId: input.sourceId }
    })
    if (existing) return existing
    const entity = await this.arRepo.save(this.arRepo.create({
      tenantId: user.tenantId,
      customerId: input.customerId,
      sourceType: 'SALE_ORDER',
      sourceId: input.sourceId,
      sourceNo: input.sourceNo,
      amount: input.amount,
      dueDate: input.dueDate ?? null,
      status: 'OPEN'
    }))
    await this.auditService.record({ bizType: 'receivable', bizId: entity.id, action: 'AUTO_CREATE_RECEIVABLE', afterValue: entity }, user)
    return entity
  }

  async ensurePurchasePayable(
    input: { supplierId: number; sourceId: number; sourceNo: string; amount: string; dueDate?: string | null },
    user: JwtUser
  ): Promise<PayableEntity> {
    const existing = await this.apRepo.findOne({
      where: { tenantId: user.tenantId, sourceType: 'PURCHASE_RECEIPT', sourceId: input.sourceId }
    })
    if (existing) return existing
    const entity = await this.apRepo.save(this.apRepo.create({
      tenantId: user.tenantId,
      supplierId: input.supplierId,
      sourceType: 'PURCHASE_RECEIPT',
      sourceId: input.sourceId,
      sourceNo: input.sourceNo,
      amount: input.amount,
      dueDate: input.dueDate ?? null,
      status: 'OPEN'
    }))
    await this.auditService.record({ bizType: 'payable', bizId: entity.id, action: 'AUTO_CREATE_PAYABLE', afterValue: entity }, user)
    return entity
  }

  /** 销售佣金发放生成应付单（同一佣金记录幂等） */
  async ensureCommissionPayable(
    input: { supplierId: number; sourceId: number; sourceNo: string; amount: string; remark?: string },
    user: JwtUser
  ): Promise<PayableEntity> {
    const existing = await this.apRepo.findOne({
      where: { tenantId: user.tenantId, sourceType: 'SALES_COMMISSION', sourceId: input.sourceId }
    })
    if (existing) return existing
    const entity = await this.apRepo.save(this.apRepo.create({
      tenantId: user.tenantId,
      supplierId: input.supplierId,
      sourceType: 'SALES_COMMISSION',
      sourceId: input.sourceId,
      sourceNo: input.sourceNo,
      amount: input.amount,
      dueDate: null,
      status: 'OPEN',
      remark: input.remark ?? null
    }))
    await this.auditService.record({ bizType: 'payable', bizId: entity.id, action: 'AUTO_CREATE_COMMISSION_PAYABLE', afterValue: entity }, user)
    return entity
  }
}
