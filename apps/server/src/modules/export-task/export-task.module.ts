import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { IoModule } from '../io/io.module'
import { OpsModule } from '../ops/ops.module'
import { ExportTaskEntity } from './entities/export-task.entity'
import { ExportTaskController } from './export-task.controller'
import { ExportTaskService } from './export-task.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([ExportTaskEntity]),
    AuditModule,
    IoModule,
    OpsModule
  ],
  controllers: [ExportTaskController],
  providers: [ExportTaskService],
  exports: [ExportTaskService]
})
export class ExportTaskModule {}
