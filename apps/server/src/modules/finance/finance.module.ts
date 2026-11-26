import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { RevisionModule } from '../revision/revision.module'
import {
  AssetController, BankConnectionController, BudgetController, CostController, CostingController,
  FinanceCategoryController, FinAccountController, FinanceQueryController, InvoiceController,
  PayableController, PaymentController, PeriodController, ReceiptController, ReceivableController,
  SubjectController, TaxController, VoucherController
} from './finance.controller'
import { FinanceIntegrationModule } from './finance-integration.module'
import { FinanceService } from './finance.service'
import { FinanceAutoVoucherSubscriber } from './finance-auto-voucher.service'
import { FinanceExtensionService } from './finance-extension.service'
import { FinanceExtensionController } from './finance-extension.controller'
import { CostRecalculationService } from './cost-recalculation.service'
import { BankConnectionService } from './bank-connection.service'
import { CostingService } from './costing.service'
import { ProductEntity } from '../master-data/entities/product.entity'
import { FinCostPeriodLockEntity, StockCostLayerEntity } from '../inventory/entities/stock-cost-layer.entity'
import { StockBalanceEntity, StockLedgerEntity } from '../inventory/entities/inventory.entities'
import { CostJobEntity } from './entities/cost-job.entity'
import { BankTransactionEntity } from './entities/bank-transaction.entity'
import {
  FinBadDebtProvisionEntity, FinBankMatchEntity, FinBudgetOccupationEntity, FinCashflowCalendarEntity,
  FinCashflowScenarioEntity, FinCashFlowReportEntity, FinCollectionPlanEntity, FinExpenseClaimAllocEntity,
  FinExpenseClaimEntity, FinExpensePolicyEntity, FinPeriodCheckEntity, FinVoucherAttachmentEntity,
  FinVoucherTemplateEntity
} from './entities/finance-extension.entity'
import {
  FinAccountTransferEntity, FinAssetChangeEntity, FinPeriodCarryEntity
} from './entities/finance-period.entity'
import {
  FinBankConnectionEntity, FinInventoryCostingEntity, FinOpeningBalanceEntity
} from './entities/finance-ledger.entity'
import {
  AccountSubjectEntity, FinAccountEntity, FinAssetDepreciationEntity, FinAssetEntity, FinBudgetEntity,
  FinCategoryEntity, FinCostEntity, FinInvoiceEntity, FinPaymentEntity, FinPeriodEntity, FinReceiptEntity,
  FinTaxCodeEntity, FinTaxDeclarationEntity, FinWriteoffEntity,
  PayableEntity, ReceivableEntity, VoucherEntity, VoucherEntryEntity
} from './entities/finance.entities'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountSubjectEntity,
      FinAccountEntity,
      VoucherEntity,
      VoucherEntryEntity,
      ReceivableEntity,
      PayableEntity,
      FinReceiptEntity,
      FinPaymentEntity,
      FinWriteoffEntity,
      FinInvoiceEntity,
      FinAssetEntity,
      FinAssetDepreciationEntity,
      FinPeriodEntity,
      FinCostEntity,
      FinBudgetEntity,
      CostJobEntity,
      BankTransactionEntity,
      FinVoucherTemplateEntity,
      FinVoucherAttachmentEntity,
      FinExpensePolicyEntity,
      FinExpenseClaimEntity,
      FinExpenseClaimAllocEntity,
      FinBadDebtProvisionEntity,
      FinCollectionPlanEntity,
      FinBankMatchEntity,
      FinCashflowScenarioEntity,
      FinCashflowCalendarEntity,
      FinPeriodCheckEntity,
      FinBudgetOccupationEntity,
      FinCashFlowReportEntity,
      FinPeriodCarryEntity,
      FinAccountTransferEntity,
      FinAssetChangeEntity,
      StockLedgerEntity,
      StockBalanceEntity,
      StockCostLayerEntity,
      FinCostPeriodLockEntity,
      ProductEntity,
      FinOpeningBalanceEntity,
      FinBankConnectionEntity,
      FinInventoryCostingEntity,
      FinTaxCodeEntity,
      FinTaxDeclarationEntity,
      FinCategoryEntity
    ]),
    AuditModule,
    FinanceIntegrationModule,
    RevisionModule
  ],
  controllers: [
    SubjectController,
    FinAccountController,
    VoucherController,
    FinanceQueryController,
    ReceivableController,
    PayableController,
    ReceiptController,
    PaymentController,
    InvoiceController,
    TaxController,
    FinanceCategoryController,
    AssetController,
    PeriodController,
    CostController,
    BudgetController,
    FinanceExtensionController,
    BankConnectionController,
    CostingController
  ],
  providers: [FinanceService, FinanceExtensionService, CostRecalculationService, BankConnectionService, CostingService, FinanceAutoVoucherSubscriber],
  exports: [FinanceService, FinanceIntegrationModule, TypeOrmModule]
})
export class FinanceModule {}
