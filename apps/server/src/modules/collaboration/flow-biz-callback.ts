import { Global, Injectable, Module } from '@nestjs/common'
import type { JwtUser } from '../../common/contracts'
import type { FlowInstanceEntity } from './entities/collaboration.entities'

/** 流程终态回调上下文 */
export interface FlowBizCallbackContext {
  /** 流程实例 */
  instance: FlowInstanceEntity
  /** 业务单据 ID */
  bizId: number
  /** 触发终态的操作人 */
  user: JwtUser
  /** 审批意见（驳回时为原因） */
  comment?: string
}

/** 业务模块实现的流程处理器 */
export interface FlowBizCallback {
  bizType: string
  /** 流程审批通过时调用（业务动作在此同步执行，保证一致性） */
  onApproved(ctx: FlowBizCallbackContext): Promise<void>
  /** 流程驳回时调用 */
  onRejected(ctx: FlowBizCallbackContext): Promise<void>
  /** 发起人撤回流程时调用 */
  onWithdrawn?(ctx: FlowBizCallbackContext): Promise<void>
  /** 待办转办/委托时调用 */
  onDelegated?(ctx: FlowBizCallbackContext): Promise<void>
  /** 加签时调用 */
  onAddSign?(ctx: FlowBizCallbackContext): Promise<void>
}

/**
 * 全局流程业务回调注册表。业务模块在 onModuleInit 注册处理器，
 * 审批引擎在流程到达终态时同步调用，避免 CollaborationModule 与业务模块循环依赖。
 */
@Injectable()
export class FlowBizCallbackRegistry {
  private readonly callbacks = new Map<string, FlowBizCallback>()

  register(callback: FlowBizCallback): void {
    this.callbacks.set(callback.bizType, callback)
  }

  get(bizType: string): FlowBizCallback | undefined {
    return this.callbacks.get(bizType)
  }

  list(): string[] {
    return [...this.callbacks.keys()]
  }

  /** 通知业务模块流程过程动作；未实现对应处理器时静默跳过 */
  async notifyAction(
    bizType: string,
    action: 'WITHDRAWN' | 'DELEGATED' | 'ADD_SIGN',
    ctx: FlowBizCallbackContext
  ): Promise<void> {
    const callback = this.callbacks.get(bizType)
    if (!callback) return
    const handler = action === 'WITHDRAWN'
      ? callback.onWithdrawn
      : action === 'DELEGATED'
        ? callback.onDelegated
        : callback.onAddSign
    if (handler) await handler.call(callback, ctx)
  }
}

@Global()
@Module({
  providers: [FlowBizCallbackRegistry],
  exports: [FlowBizCallbackRegistry]
})
export class FlowBizCallbackRegistryModule {}
