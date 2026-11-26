import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { InventoryModule } from '../inventory/inventory.module'
import { MasterDataModule } from '../master-data/master-data.module'
import { OpsModule } from '../ops/ops.module'
import { SalesModule } from '../sales/sales.module'
import {
  ShopActivityStockController, ShopCouponController, ShopCsController, ShopGoodsMapController,
  ShopOrderController, ShopPaymentController, ShopPromotionController, ShopPromotionEffectController,
  ShopQueryController, ShopReconciliationController, ShopRefundController, ShopSeckillController,
  ShopStoreController, ShopWaybillController
} from './shop.controller'
import { ShopService } from './shop.service'
import {
  ShopActivityOrderEntity, ShopActivityStockEntity, ShopCouponEntity, ShopCsConversationEntity,
  ShopGoodsMapEntity, ShopOrderEntity, ShopPaymentConfigEntity, ShopPromotionEntity,
  ShopCsQualityReviewEntity, ShopReconcileBillEntity, ShopRefundEntity, ShopSeckillEntity,
  ShopStoreEntity, ShopSyncLogEntity, ShopTrackingEventEntity, ShopWaybillEntity
} from './entities/shop.entities'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShopStoreEntity,
      ShopGoodsMapEntity,
      ShopOrderEntity,
      ShopSyncLogEntity,
      ShopPromotionEntity,
      ShopPaymentConfigEntity,
      ShopWaybillEntity,
      ShopCsConversationEntity,
      ShopCouponEntity,
      ShopSeckillEntity,
      ShopActivityStockEntity,
      ShopActivityOrderEntity,
      ShopReconcileBillEntity,
      ShopRefundEntity,
      ShopTrackingEventEntity,
      ShopCsQualityReviewEntity
    ]),
    AuditModule,
    MasterDataModule,
    SalesModule,
    InventoryModule,
    OpsModule
  ],
  controllers: [
    ShopStoreController,
    ShopGoodsMapController,
    ShopOrderController,
    ShopPromotionController,
    ShopPaymentController,
    ShopWaybillController,
    ShopCsController,
    ShopQueryController,
    ShopCouponController,
    ShopSeckillController,
    ShopActivityStockController,
    ShopPromotionEffectController,
    ShopReconciliationController,
    ShopRefundController
  ],
  providers: [ShopService],
  exports: [ShopService, TypeOrmModule]
})
export class ShopModule {}
