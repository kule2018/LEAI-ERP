import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { IoModule } from '../io/io.module'
import { MasterDataModule } from '../master-data/master-data.module'
import { ProductEntity } from '../master-data/entities/product.entity'
import { OpsModule } from '../ops/ops.module'
import { RevisionModule } from '../revision/revision.module'
import { TenantEntity } from '../platform/entities/tenant.entity'
import {
  AdjustmentController, AlertController, AssemblyController, BalanceController, BatchProfileController,
  CostingController, InventoryReportController, LedgerController, LockController, MovementController,
  NegativeStockController, PickPathController, PutawayController, PutawayStrategyController,
  RecallController, StocktakeController, TransferController, WaveController
} from './inventory.controller'
import { InventoryAlertService } from './inventory-alert.service'
import { InventoryService } from './inventory.service'
import {
  StockAlertEntity, StockAssemblyEntity, StockAssemblyLineEntity, StockBalanceEntity,
  StockLedgerEntity, StockLockEntity, StocktakeEntity, StocktakeLineEntity,
  StockTransferEntity, StockTransferLineEntity, WmsPickTaskEntity, WmsPickWaveEntity, WmsPutawayEntity,
  WmsPutawayStrategyEntity
} from './entities/inventory.entities'
import { BatchProfileEntity } from './entities/batch-profile.entity'
import { StockAlertPolicyEntity } from './entities/stock-alert-policy.entity'
import { StockAdjustmentEntity, StockAdjustmentLineEntity } from './entities/stock-adjustment.entity'
import { FinCostPeriodLockEntity, StockCostLayerEntity } from './entities/stock-cost-layer.entity'
import { StockIoAttachmentEntity, StockIoDocumentEntity, StockIoLineEntity } from './entities/stock-io.entity'
import { StockIoController } from './stock-io.controller'
import { StockIoService } from './stock-io.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockBalanceEntity,
      StockLedgerEntity,
      StockLockEntity,
      StockAlertEntity,
      StocktakeEntity,
      StocktakeLineEntity,
      StockTransferEntity,
      StockTransferLineEntity,
      WmsPutawayEntity,
      WmsPickWaveEntity,
      WmsPickTaskEntity,
      StockAssemblyEntity,
      StockAssemblyLineEntity,
      WmsPutawayStrategyEntity,
      BatchProfileEntity,
      StockAlertPolicyEntity,
      StockAdjustmentEntity,
      StockAdjustmentLineEntity,
      StockCostLayerEntity,
      FinCostPeriodLockEntity,
      StockIoDocumentEntity,
      StockIoLineEntity,
      StockIoAttachmentEntity,
      ProductEntity,
      TenantEntity
    ]),
    AuditModule,
    MasterDataModule,
    OpsModule,
    IoModule,
    RevisionModule
  ],
  controllers: [
    BalanceController,
    LedgerController,
    MovementController,
    LockController,
    AlertController,
    StocktakeController,
    TransferController,
    PutawayController,
    WaveController,
    AssemblyController,
    RecallController,
    InventoryReportController,
    PutawayStrategyController,
    PickPathController,
    BatchProfileController,
    AdjustmentController,
    CostingController,
    NegativeStockController,
    StockIoController
  ],
  providers: [InventoryService, InventoryAlertService, StockIoService],
  exports: [InventoryService, StockIoService, TypeOrmModule]
})
export class InventoryModule {}
