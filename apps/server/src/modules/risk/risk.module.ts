import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AlertModule } from '../alert/alert.module'
import { AuditModule } from '../audit/audit.module'
import { FlowInstanceEntity, FlowTaskEntity } from '../collaboration/entities/collaboration.entities'
import { OpsModule } from '../ops/ops.module'
import { TenantEntity } from '../platform/entities/tenant.entity'
import { ReceivableEntity } from '../finance/entities/finance.entities'
import { StockAlertEntity } from '../inventory/entities/inventory.entities'
import { CustomerEntity } from '../master-data/entities/customer.entity'
import { ShopSyncLogEntity } from '../shop/entities/shop.entities'
import { RiskController } from './risk.controller'
import { RiskService } from './risk.service'
import { RiskAlertEntity } from './entities/risk-alert.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RiskAlertEntity,
      CustomerEntity,
      StockAlertEntity,
      ReceivableEntity,
      FlowInstanceEntity,
      FlowTaskEntity,
      ShopSyncLogEntity,
      TenantEntity
    ]),
    AuditModule,
    OpsModule,
    AlertModule
  ],
  controllers: [RiskController],
  providers: [RiskService],
  exports: [RiskService]
})
export class RiskModule {}
