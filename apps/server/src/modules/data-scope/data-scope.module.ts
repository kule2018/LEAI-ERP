import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { DataScopeController } from './data-scope.controller'
import { DataScopeService } from './data-scope.service'
import { DataScopeEntity } from './entities/data-scope.entity'

@Module({
  imports: [TypeOrmModule.forFeature([DataScopeEntity]), AuditModule],
  controllers: [DataScopeController],
  providers: [DataScopeService],
  exports: [DataScopeService, TypeOrmModule]
})
export class DataScopeModule {}
