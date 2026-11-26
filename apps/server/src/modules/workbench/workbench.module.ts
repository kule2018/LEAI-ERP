import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { FlowTaskEntity } from '../collaboration/entities/collaboration.entities'
import { PayableEntity, ReceivableEntity } from '../finance/entities/finance.entities'
import { CustomerEntity } from '../master-data/entities/customer.entity'
import { ProductCategoryEntity } from '../master-data/entities/product-category.entity'
import { ProductEntity } from '../master-data/entities/product.entity'
import { NotifyModule } from '../notify/notify.module'
import { OpsModule } from '../ops/ops.module'
import { PurchaseOrderEntity } from '../purchase/entities/purchase.entities'
import { RiskAlertEntity } from '../risk/entities/risk-alert.entity'
import { SaleOrderEntity, SaleOrderLineEntity } from '../sales/entities/sales.entities'
import { WorkbenchBriefingEntity, WorkbenchKpiEntity, WorkbenchSubscriptionEntity } from './entities/workbench.entities'
import { WorkbenchController } from './workbench.controller'
import { WorkbenchService } from './workbench.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkbenchKpiEntity, WorkbenchSubscriptionEntity, WorkbenchBriefingEntity,
      SaleOrderEntity, SaleOrderLineEntity, PurchaseOrderEntity,
      ReceivableEntity, PayableEntity, RiskAlertEntity, FlowTaskEntity,
      CustomerEntity, ProductEntity, ProductCategoryEntity
    ]),
    AuditModule,
    NotifyModule,
    OpsModule
  ],
  controllers: [WorkbenchController],
  providers: [WorkbenchService],
  exports: [WorkbenchService]
})
export class WorkbenchModule {}
