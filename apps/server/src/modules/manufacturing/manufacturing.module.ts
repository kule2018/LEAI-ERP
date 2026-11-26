import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { InventoryModule } from '../inventory/inventory.module'
import { MasterDataModule } from '../master-data/master-data.module'
import { PurchaseModule } from '../purchase/purchase.module'
import { RevisionModule } from '../revision/revision.module'
import { PurchaseDemandEntity } from '../purchase/entities/purchase.entities'
import { SalesModule } from '../sales/sales.module'
import {
  BomController, DemandSummaryController, EquipmentController, ExceptionController, ManufacturingReportController,
  MaterialReturnController, MrpController, PlanController, QcController, RoutingController, WorkCenterController,
  WorkOrderController
} from './manufacturing.controller'
import { ManufacturingService } from './manufacturing.service'
import { ManufacturingExtensionService } from './manufacturing-extension.service'
import { ManufacturingExtensionController } from './manufacturing-extension.controller'
import { EquipmentInspectionEntity } from './entities/equipment-inspection.entity'
import { MesMaterialReturnEntity, MesMaterialReturnLineEntity } from './entities/mes-material-return.entity'
import {
  MesBomChangeEntity, MesChangeoverLogEntity, MesChangeoverRuleEntity, MesEquipmentFaultEntity,
  MesEquipmentMaintenanceEntity, MesOverIssueApprovalEntity, MesPlanTaskLockEntity, MesQcItemEntity,
  MesWorkOrderChangeEntity
} from './entities/manufacturing-extension.entity'
import { StockBalanceEntity } from '../inventory/entities/inventory.entities'
import { StockAlertPolicyEntity } from '../inventory/entities/stock-alert-policy.entity'
import { SaleOrderLineEntity } from '../sales/entities/sales.entities'
import { PurchaseOrderLineEntity } from '../purchase/entities/purchase.entities'
import {
  BomEntity, BomItemEntity, EquipmentEntity, MrpRunEntity, MrpSuggestEntity, OperationEntity,
  PlanTaskEntity, ProductionExceptionEntity, QcEntity, RoutingEntity, WorkCenterEntity,
  WorkOrderCompleteEntity, WorkOrderEntity, WorkOrderIssueEntity, WorkOrderReportEntity
} from './entities/manufacturing.entities'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BomEntity,
      BomItemEntity,
      WorkCenterEntity,
      RoutingEntity,
      OperationEntity,
      MrpRunEntity,
      MrpSuggestEntity,
      PlanTaskEntity,
      WorkOrderEntity,
      WorkOrderIssueEntity,
      WorkOrderReportEntity,
      WorkOrderCompleteEntity,
      QcEntity,
      EquipmentEntity,
      ProductionExceptionEntity,
      PurchaseDemandEntity,
      StockAlertPolicyEntity,
      EquipmentInspectionEntity,
      MesBomChangeEntity,
      MesWorkOrderChangeEntity,
      MesQcItemEntity,
      MesEquipmentFaultEntity,
      MesEquipmentMaintenanceEntity,
      MesPlanTaskLockEntity,
      MesOverIssueApprovalEntity,
      MesChangeoverRuleEntity,
      MesChangeoverLogEntity,
      StockBalanceEntity,
      SaleOrderLineEntity,
      PurchaseOrderLineEntity,
      MesMaterialReturnEntity,
      MesMaterialReturnLineEntity
    ]),
    AuditModule,
    MasterDataModule,
    InventoryModule,
    SalesModule,
    PurchaseModule,
    RevisionModule
  ],
  controllers: [
    BomController,
    WorkCenterController,
    RoutingController,
    MrpController,
    PlanController,
    WorkOrderController,
    QcController,
    EquipmentController,
    ExceptionController,
    ManufacturingReportController,
    MaterialReturnController,
    DemandSummaryController,
    ManufacturingExtensionController
  ],
  providers: [ManufacturingService, ManufacturingExtensionService],
  exports: [ManufacturingService, ManufacturingExtensionService, TypeOrmModule]
})
export class ManufacturingModule {}
