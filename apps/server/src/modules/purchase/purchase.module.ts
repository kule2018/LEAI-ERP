import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { CollaborationModule } from '../collaboration/collaboration.module'
import { FinanceIntegrationModule } from '../finance/finance-integration.module'
import { FinBudgetEntity, FinInvoiceEntity } from '../finance/entities/finance.entities'
import { InventoryModule } from '../inventory/inventory.module'
import { MasterDataModule } from '../master-data/master-data.module'
import { RevisionModule } from '../revision/revision.module'
import {
  CarrierController,
  DemandController,
  EvaluateController,
  OutsourceController,
  SupplierPortalController,
  PurchaseContractController,
  PurchaseOrderController,
  PurchasePriceController,
  PurchaseReportController,
  PurchaseReturnController,
  ReceiptController,
  RfqController,
  VendorStatementController,
  WaybillController
} from './purchase.controller'
import { PurchaseService } from './purchase.service'
import {
  GoodsReceiptEntity,
  GoodsReceiptLineEntity,
  LogisticsCarrierEntity,
  LogisticsTrackNodeEntity,
  LogisticsWaybillEntity,
  OutsourceLossEntity,
  OutsourceOrderEntity,
  OutsourceOrderLineEntity,
  PurchaseArrivalPlanEntity,
  PurchaseAwardEntity,
  PurchaseContractEntity,
  PurchaseCostFlowEntity,
  PurchaseDemandEntity,
  PurchaseDemandMergeEntity,
  PurchaseFrameAgreementEntity,
  PurchaseMatchEvidenceEntity,
  PurchaseOrderChangeEntity,
  PurchaseOrderEntity,
  PurchaseOrderLineEntity,
  PurchasePriceEntity,
  PurchasePriceHistoryEntity,
  PurchaseProvisionalEntity,
  PurchaseReturnEntity,
  PurchaseReturnLineEntity,
  PurchaseSupplierBlacklistEntity,
  PurQuotationEntity,
  PurQuotationLineEntity,
  PurSupplierQuoteEntity,
  SupplierBankAccountEntity,
  SupplierEvaluateEntity,
  SupplierPortalActionEntity,
  SupplierQualificationEntity,
  VendorStatementEntity
} from './entities/purchase.entities'
import {
  AwardExtensionController,
  ComplianceExtensionController,
  LogisticsExtensionController,
  OrderExtensionController,
  OutsourceExtensionController,
  PriceExtensionController,
  ReceiptExtensionController,
  StatementExtensionController,
  SupplierExtensionController
} from './purchase-extension.controller'
import { PurchaseExtensionService } from './purchase-extension.service'
import { CrossDockController, SupplierFineController } from './purchase-p1.controller'
import { PurchaseP1Service } from './purchase-p1.service'
import { CrossDockEntity, SupplierFineEntity } from './entities/purchase-extension-p1.entity'
import { SupplierEntity } from '../master-data/entities/supplier.entity'
import { SupplierPortalUserEntity } from './entities/supplier-portal.entities'
import { SupplierPortalAccountController, SupplierPortalAuthController, SupplierPortalExternalController } from './supplier-portal.controller'
import { SupplierPortalService } from './supplier-portal.service'
import { TenantEntity } from '../platform/entities/tenant.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupplierEvaluateEntity,
      PurQuotationEntity,
      PurQuotationLineEntity,
      PurSupplierQuoteEntity,
      PurchaseDemandEntity,
      PurchaseOrderEntity,
      PurchaseOrderLineEntity,
      GoodsReceiptEntity,
      GoodsReceiptLineEntity,
      VendorStatementEntity,
      PurchaseReturnEntity,
      PurchaseReturnLineEntity,
      PurchaseContractEntity,
      PurchasePriceEntity,
      LogisticsCarrierEntity,
      LogisticsWaybillEntity,
      OutsourceOrderEntity,
      OutsourceOrderLineEntity,
      OutsourceLossEntity,
      LogisticsTrackNodeEntity,
      SupplierQualificationEntity,
      SupplierBankAccountEntity,
      SupplierPortalActionEntity,
      PurchaseAwardEntity,
      PurchaseDemandMergeEntity,
      PurchaseOrderChangeEntity,
      PurchaseArrivalPlanEntity,
      PurchaseProvisionalEntity,
      PurchaseCostFlowEntity,
      PurchasePriceHistoryEntity,
      FinInvoiceEntity,
      FinBudgetEntity,
      PurchaseMatchEvidenceEntity,
      PurchaseFrameAgreementEntity,
      PurchaseSupplierBlacklistEntity,
      SupplierPortalUserEntity,
      TenantEntity,
      SupplierEntity,
      CrossDockEntity,
      SupplierFineEntity
    ]),
    AuditModule,
    CollaborationModule,
    JwtModule.register({}),
    MasterDataModule,
    InventoryModule,
    FinanceIntegrationModule,
    RevisionModule
  ],
  controllers: [
    EvaluateController,
    RfqController,
    DemandController,
    PurchaseOrderController,
    ReceiptController,
    VendorStatementController,
    PurchaseReturnController,
    PurchaseContractController,
    PurchasePriceController,
    CarrierController,
    WaybillController,
    PurchaseReportController,
    OutsourceController,
    SupplierPortalController,
    SupplierExtensionController,
    AwardExtensionController,
    OrderExtensionController,
    ReceiptExtensionController,
    StatementExtensionController,
    OutsourceExtensionController,
    LogisticsExtensionController,
    PriceExtensionController,
    ComplianceExtensionController,
    SupplierPortalExternalController,
    SupplierPortalAuthController,
    SupplierPortalAccountController,
    CrossDockController,
    SupplierFineController
  ],
  providers: [PurchaseService, PurchaseExtensionService, SupplierPortalService, PurchaseP1Service],
  exports: [PurchaseService, PurchaseExtensionService, SupplierPortalService, PurchaseP1Service, TypeOrmModule]
})
export class PurchaseModule {}
