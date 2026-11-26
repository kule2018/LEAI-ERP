import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor'
import { AuditController } from './audit.controller'
import { AuditService } from './audit.service'
import { AuditLogEntity } from './entities/audit-log.entity'
import { AuditFieldLogEntity } from './entities/audit-field-log.entity'

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity, AuditFieldLogEntity])],
  controllers: [AuditController],
  providers: [
    AuditService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor
    }
  ],
  exports: [AuditService, TypeOrmModule]
})
export class AuditModule {}
