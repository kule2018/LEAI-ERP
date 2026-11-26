import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { CustomFieldModule } from '../customization/custom-field.module'
import { OpsModule } from '../ops/ops.module'
import { IoController } from './io.controller'
import { IoService } from './io.service'
import { IoJobEntity } from './entities/io-job.entity'
import { IoImportErrorEntity } from './entities/io-import-error.entity'
import { IoImportMappingEntity } from './entities/io-import-mapping.entity'
import { IoImportTaskEntity } from './entities/io-import-task.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([IoJobEntity, IoImportMappingEntity, IoImportErrorEntity, IoImportTaskEntity]),
    AuditModule,
    OpsModule,
    CustomFieldModule
  ],
  controllers: [IoController],
  providers: [IoService],
  exports: [IoService, TypeOrmModule]
})
export class IoModule {}
