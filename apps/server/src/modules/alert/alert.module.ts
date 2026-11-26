import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { AlertController } from './alert.controller'
import { AlertService } from './alert.service'
import { AlertRuleEntity } from './entities/alert-rule.entity'

@Module({
  imports: [TypeOrmModule.forFeature([AlertRuleEntity]), AuditModule],
  controllers: [AlertController],
  providers: [AlertService],
  exports: [AlertService]
})
export class AlertModule {}
