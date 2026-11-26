import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { ApiKeyGuard } from './guards/api-key.guard'
import { ApiCallLogEntity } from './entities/api-call-log.entity'
import { ApiKeyEntity, WebhookDeliveryEntity, WebhookEntity } from './entities/openapi.entities'
import { OpenApiController, OpenApiExternalController } from './openapi.controller'
import { OpenApiService } from './openapi.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKeyEntity, WebhookEntity, WebhookDeliveryEntity, ApiCallLogEntity]),
    AuditModule
  ],
  controllers: [OpenApiController, OpenApiExternalController],
  providers: [OpenApiService, ApiKeyGuard],
  exports: [OpenApiService]
})
export class OpenApiModule {}
