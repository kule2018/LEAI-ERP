import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { CustomFieldModule } from '../customization/custom-field.module'
import { PrintController } from './print.controller'
import { PrintService } from './print.service'
import { PrintJobEntity } from './entities/print-job.entity'
import { PrintLabelTemplateEntity } from './entities/print-label-template.entity'
import { PrintBarcodeRuleEntity, PrintLabelInstanceEntity } from './entities/print-label-instance.entity'
import { PrintRecordEntity } from './entities/print-record.entity'
import { PrintTemplateEntity } from './entities/print-template.entity'
import { StockIoDocumentEntity, StockIoLineEntity } from '../inventory/entities/stock-io.entity'
import { SaleOrderEntity, SaleOrderLineEntity } from '../sales/entities/sales.entities'
import { PurchaseOrderEntity, PurchaseOrderLineEntity } from '../purchase/entities/purchase.entities'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PrintTemplateEntity,
      PrintRecordEntity,
      PrintJobEntity,
      PrintLabelTemplateEntity,
      PrintLabelInstanceEntity,
      PrintBarcodeRuleEntity,
      StockIoDocumentEntity,
      StockIoLineEntity,
      SaleOrderEntity,
      SaleOrderLineEntity,
      PurchaseOrderEntity,
      PurchaseOrderLineEntity
    ]),
    AuditModule,
    CustomFieldModule
  ],
  controllers: [PrintController],
  providers: [PrintService],
  exports: [PrintService, TypeOrmModule]
})
export class PrintModule {}
