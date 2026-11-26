import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { DictController } from './dict.controller'
import { DictService } from './dict.service'
import { DictEntity } from './entities/dict.entity'
import { DictItemEntity } from './entities/dict-item.entity'

@Module({
  imports: [TypeOrmModule.forFeature([DictEntity, DictItemEntity]), AuditModule],
  controllers: [DictController],
  providers: [DictService],
  exports: [DictService, TypeOrmModule]
})
export class DictModule {}
