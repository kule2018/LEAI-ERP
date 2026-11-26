import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { CollaborationModule } from '../collaboration/collaboration.module'
import { FinanceIntegrationModule } from '../finance/finance-integration.module'
import { InventoryModule } from '../inventory/inventory.module'
import { MasterDataModule } from '../master-data/master-data.module'
import { RevisionModule } from '../revision/revision.module'
import {
  ClauseController, ContractController, CustomerMergeController,
  CrmCustomerController,
  CrmChurnController,
  FollowController,
  LeadController,
  OpportunityController,
  PosController, PosHangController, PosPaymentController, PosMemberPriceController,
  PriceAgreementController,
  QuotationController, QuotationVersionController,
  SaleOrderController,
  SaleProductController,
  SaleReportController,
  SaleReturnController, SaleRedInvoiceController,
  SaleTargetController,
  ShipmentController,
  StatementController
} from './sales.controller'
import { SalesService } from './sales.service'
import { SalesCounterService } from './sales-counter.service'
import { SalesDeliveryService } from './sales-delivery.service'
import {
  PosShiftController,
  PromotionBundleController,
  StatementAnalysisController
} from './sales-counter.controller'
import {
  SaleReturnExchangeController,
  ShipmentExceptionController,
  ShipmentExceptionRegisterController,
  ShipmentTrackingController,
  ShipmentWaveController
} from './sales-delivery.controller'
import {
  SalesCommissionController,
  SalesComplaintController,
  SalesCrmReportController,
  SalesP1Controller,
  SalesVisitController
} from './sales-crm-extension.controller'
import { SalesCrmExtensionService } from './sales-crm-extension.service'
import {
  CustomerCreditFlowEntity, QuotationTemplateEntity, QuotationTemplateLineEntity
} from './entities/sales-p1.entity'
import {
  SalesCommissionRecordEntity,
  SalesCommissionRuleEntity,
  SalesComplaintEntity,
  SalesComplaintLogEntity,
  SalesVisitEntity
} from './entities/sales-crm-extension.entity'
import {
  PosShiftEntity,
  SalePromotionBundleEntity,
  SalePromotionBundleItemEntity,
  SaleReturnExchangeEntity,
  ShipmentExceptionEntity,
  ShipmentTrackingNodeEntity
} from './entities/sales-delivery.entities'
import {
  CustomerMergeRequestEntity,
  CustomerStatementEntity,
  CrmChurnWarningEntity,
  CrmCustomerContactEntity,
  CrmQuotationVersionEntity,
  FollowEntity,
  LeadEntity,
  OpportunityEntity,
  PosHangOrderEntity,
  PosMemberPriceEntity,
  PosPaymentRecordEntity,
  QuotationEntity,
  QuotationLineEntity,
  SaleContractEntity,
  SaleClauseEntity,
  SaleOrderEntity,
  SaleOrderLineEntity,
  SalePriceAgreementEntity,
  SaleRedInvoiceEntity,
  SaleReturnEntity,
  SaleReturnLineEntity,
  SaleTargetEntity,
  ShipmentEntity,
  ShipmentLineEntity
} from './entities/sales.entities'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeadEntity,
      OpportunityEntity,
      FollowEntity,
      QuotationEntity,
      QuotationLineEntity,
      SaleContractEntity,
      SaleClauseEntity,
      SaleOrderEntity,
      SaleOrderLineEntity,
      CustomerStatementEntity,
      ShipmentEntity,
      ShipmentLineEntity,
      SaleReturnEntity,
      SaleReturnLineEntity,
      SalePriceAgreementEntity,
      SaleTargetEntity,
      CustomerMergeRequestEntity,
      PosHangOrderEntity,
      CrmCustomerContactEntity,
      CrmChurnWarningEntity,
      CrmQuotationVersionEntity,
      PosMemberPriceEntity,
      PosPaymentRecordEntity,
      SaleRedInvoiceEntity,
      ShipmentTrackingNodeEntity,
      ShipmentExceptionEntity,
      PosShiftEntity,
      SalePromotionBundleEntity,
      SalePromotionBundleItemEntity,
      SaleReturnExchangeEntity,
      SalesCommissionRuleEntity,
      SalesCommissionRecordEntity,
      SalesComplaintEntity,
      SalesComplaintLogEntity,
      SalesVisitEntity,
      QuotationTemplateEntity,
      QuotationTemplateLineEntity,
      CustomerCreditFlowEntity
    ]),
    AuditModule,
    CollaborationModule,
    MasterDataModule,
    InventoryModule,
    FinanceIntegrationModule,
    RevisionModule
  ],
  controllers: [
    LeadController,
    OpportunityController,
    FollowController,
    QuotationController,
    ContractController,
    ClauseController,
    SaleOrderController,
    SaleProductController,
    PosController,
    StatementController,
    ShipmentController,
    SaleReturnController,
    PriceAgreementController,
    SaleTargetController,
    SaleReportController,
    CustomerMergeController,
    PosHangController,
    CrmCustomerController,
    CrmChurnController,
    QuotationVersionController,
    PosPaymentController,
    PosMemberPriceController,
    SaleRedInvoiceController,
    ShipmentTrackingController,
    ShipmentWaveController,
    ShipmentExceptionController,
    ShipmentExceptionRegisterController,
    SaleReturnExchangeController,
    PosShiftController,
    PromotionBundleController,
    StatementAnalysisController,
    SalesCommissionController,
    SalesComplaintController,
    SalesVisitController,
    SalesCrmReportController,
    SalesP1Controller
  ],
  providers: [SalesService, SalesDeliveryService, SalesCounterService, SalesCrmExtensionService],
  exports: [SalesService, SalesDeliveryService, SalesCounterService, SalesCrmExtensionService, TypeOrmModule]
})
export class SalesModule {}
