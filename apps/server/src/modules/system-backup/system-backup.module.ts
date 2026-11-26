import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { OpsModule } from '../ops/ops.module'
import { SysBackupPolicyEntity, SysBackupRecordEntity, SysRestoreRecordEntity } from './entities/backup.entities'
import { SystemBackupController } from './system-backup.controller'
import { SystemBackupService } from './system-backup.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([SysBackupPolicyEntity, SysBackupRecordEntity, SysRestoreRecordEntity]),
    AuditModule,
    OpsModule
  ],
  controllers: [SystemBackupController],
  providers: [SystemBackupService],
  exports: [SystemBackupService]
})
export class SystemBackupModule {}