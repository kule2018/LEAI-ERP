import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { IntegrationConfigEntity, IntegrationMessageEntity } from './entities/integration.entities'
import { IntegrationController } from './integration.controller'
import { IntegrationService } from './integration.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationConfigEntity, IntegrationMessageEntity]),
    AuditModule
  ],
  controllers: [IntegrationController],
  providers: [IntegrationService],
  exports: [IntegrationService]
})
export class IntegrationModule {}
