import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { AccountSubjectEntity, ReceivableEntity, VoucherEntity } from '../finance/entities/finance.entities'
import { SaleOrderLineEntity } from '../sales/entities/sales.entities'
import { ShopSyncLogEntity } from '../shop/entities/shop.entities'
import { StockBalanceEntity } from '../inventory/entities/inventory.entities'
import { PurchaseModule } from '../purchase/purchase.module'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { AiDraftApplierRegistryModule } from './ai-draft-applier'
import {
  AiForecastSuggestionEntity,
  AiKnowledgeChunkEntity,
  AiKnowledgeDocEntity,
  AiModelConfigEntity,
  AiTaskEntity
} from './entities/ai-extension.entities'
import { AiAuditLogEntity } from './entities/ai-audit-log.entity'
import { AiConversationEntity } from './entities/ai-conversation.entity'
import { AiMessageEntity } from './entities/ai-message.entity'
import { AiPromptEntity } from './entities/ai-prompt.entity'
import { AiAnomalyEntity } from './entities/ai-anomaly.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiPromptEntity,
      AiAuditLogEntity,
      AiConversationEntity,
      AiMessageEntity,
      AiTaskEntity,
      AiAnomalyEntity,
      AiModelConfigEntity,
      AiKnowledgeDocEntity,
      AiKnowledgeChunkEntity,
      AiForecastSuggestionEntity,
      SaleOrderLineEntity,
      StockBalanceEntity,
      ReceivableEntity,
      VoucherEntity,
      ShopSyncLogEntity,
      AccountSubjectEntity
    ]),
    AuditModule,
    AiDraftApplierRegistryModule,
    PurchaseModule
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService, TypeOrmModule]
})
export class AiModule {}
