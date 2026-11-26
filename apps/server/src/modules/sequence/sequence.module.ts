import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { SequenceController } from './sequence.controller'
import { SequenceService } from './sequence.service'
import { SequenceEntity } from './entities/sequence.entity'

@Module({
  imports: [TypeOrmModule.forFeature([SequenceEntity]), AuditModule],
  controllers: [SequenceController],
  providers: [SequenceService],
  exports: [SequenceService, TypeOrmModule]
})
export class SequenceModule {}
