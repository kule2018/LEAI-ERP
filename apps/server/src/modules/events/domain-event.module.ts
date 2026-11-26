import { Global, Injectable, Module, OnModuleInit } from '@nestjs/common'
import type { JwtUser } from '../../common/contracts'
import { NotifyModule } from '../notify/notify.module'
import { NotifyService } from '../notify/notify.service'

export interface DomainEvent {
  type: string
  tenantId: number
  userId: number
  bizType: string
  bizId: number
  payload?: Record<string, unknown>
  occurredAt: Date
}

export function createDomainEvent(
  type: string,
  user: JwtUser,
  bizType: string,
  bizId: number,
  payload: Record<string, unknown> = {}
): DomainEvent {
  return {
    type,
    tenantId: user.tenantId,
    userId: user.userId,
    bizType,
    bizId,
    payload,
    occurredAt: new Date()
  }
}

@Injectable()
export class DomainEventBus {
  private readonly handlers: Array<(event: DomainEvent) => Promise<void> | void> = []

  subscribe(handler: (event: DomainEvent) => Promise<void> | void): () => void {
    this.handlers.push(handler)
    return () => {
      const index = this.handlers.indexOf(handler)
      if (index >= 0) this.handlers.splice(index, 1)
    }
  }

  async emit(event: DomainEvent): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler(event)
      } catch {
        // 领域事件订阅失败不应阻断主业务流程
      }
    }
  }
}

@Injectable()
export class NotificationEventSubscriber implements OnModuleInit {
  constructor(
    private readonly bus: DomainEventBus,
    private readonly notifyService: NotifyService
  ) {}

  onModuleInit(): void {
    this.bus.subscribe((event) => this.handle(event))
  }

  private async handle(event: DomainEvent): Promise<void> {
    const templates: Record<string, { title: string; content: string }> = {
      'sales.order.created': { title: '销售单已创建', content: `销售单 ${event.bizId} 已创建，请及时提交审批。` },
      'sales.order.approved': { title: '销售单已审批', content: `销售单 ${event.bizId} 已审批，请跟踪发货与收款。` },
      'purchase.order.created': { title: '采购单已创建', content: `采购单 ${event.bizId} 已创建，请及时提交审批。` },
      'purchase.order.approved': { title: '采购单已审批', content: `采购单 ${event.bizId} 已审批，请跟踪收货与对账。` },
      'inventory.moved': { title: '库存变动', content: `业务单据 ${event.bizId} 产生库存流水，请关注库存余额。` }
    }
    const template = templates[event.type]
    if (!template) return
    const user: JwtUser = {
      userId: event.userId,
      tenantId: event.tenantId,
      username: 'system',
      realName: '系统事件',
      orgId: null,
      roles: [],
      permissions: [],
      isSuperAdmin: false,
      dataScopeLevel: 'ORG'
    }
    // 优先使用 DB 中的通知模板（code = 事件类型），未配置时回退内置模板
    try {
      const sent = await this.notifyService.sendByTemplate(event.type, {
        receiverId: event.userId,
        variables: { bizId: event.bizId, bizType: event.bizType, ...event.payload },
        level: event.type.includes('approved') ? 'HIGH' : 'LOW',
        bizType: event.bizType,
        bizId: event.bizId
      }, user)
      if (sent.length > 0) return
    } catch {
      // 模板不存在时回退内置文案
    }
    await this.notifyService.create({
      title: template.title,
      content: template.content,
      channel: 'INMAIL',
      receiverId: event.userId,
      bizType: event.bizType,
      bizId: event.bizId
    }, user)
  }
}

@Global()
@Module({
  imports: [NotifyModule],
  providers: [DomainEventBus, NotificationEventSubscriber],
  exports: [DomainEventBus]
})
export class DomainEventModule {}
