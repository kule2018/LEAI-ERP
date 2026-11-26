import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { FinanceIntegrationService } from './finance-integration.service'
import { PayableEntity, ReceivableEntity } from './entities/finance.entities'

@Module({
  imports: [TypeOrmModule.forFeature([ReceivableEntity, PayableEntity]), AuditModule],
  providers: [FinanceIntegrationService],
  exports: [FinanceIntegrationService, TypeOrmModule]
})
export class FinanceIntegrationModule {}
