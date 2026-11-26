import { Global, Injectable, Module } from '@nestjs/common'
import type { JwtUser } from '../../common/contracts'

/** AI 草稿写回的目标业务单据上下文 */
export interface AiDraftApplyContext {
  /** AI 生成的草稿字段（已映射为业务服务可接受的形状） */
  draft: Record<string, unknown>
  user: JwtUser
  /** 触发写回的 AI 审计日志 ID，用于业务单据追溯 */
  auditId: number
}

/** 写回结果 */
export interface AiDraftApplyResult {
  bizType: string
  bizId: number
  bizNo?: string
}

/** 业务模块实现的草稿写回处理器 */
export interface AiDraftApplier {
  /** 目标类型，与 docParse 的 targetType 对应，如 SALE_ORDER */
  targetType: string
  /** 写回所需权限码，确认时二次校验 */
  requiredPerm: string
  apply(ctx: AiDraftApplyContext): Promise<AiDraftApplyResult>
}

/**
 * 全局草稿写回注册表。业务模块在 onModuleInit 注册处理器，
 * AI 模块在确认时查找并调用，避免 AiModule 与业务模块的循环依赖。
 */
@Injectable()
export class AiDraftApplierRegistry {
  private readonly appliers = new Map<string, AiDraftApplier>()

  register(applier: AiDraftApplier): void {
    this.appliers.set(applier.targetType, applier)
  }

  get(targetType: string): AiDraftApplier | undefined {
    return this.appliers.get(targetType)
  }

  list(): Array<{ targetType: string; requiredPerm: string }> {
    return [...this.appliers.values()].map((a) => ({ targetType: a.targetType, requiredPerm: a.requiredPerm }))
  }
}

@Global()
@Module({
  providers: [AiDraftApplierRegistry],
  exports: [AiDraftApplierRegistry]
})
export class AiDraftApplierRegistryModule {}
