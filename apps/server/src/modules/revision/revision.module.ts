import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { RevisionSnapshotEntity } from './entities/revision-snapshot.entity'
import { RevisionController } from './revision.controller'
import { RevisionService } from './revision.service'

@Module({
  imports: [TypeOrmModule.forFeature([RevisionSnapshotEntity]), AuditModule],
  controllers: [RevisionController],
  providers: [RevisionService],
  exports: [RevisionService]
})
export class RevisionModule {}
