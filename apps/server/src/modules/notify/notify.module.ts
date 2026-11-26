import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { UserEntity } from '../platform/entities/user.entity'
import { UserRoleEntity } from '../platform/entities/user-role.entity'
import { NotificationEntity } from './entities/notification.entity'
import { NotifyRuleEntity } from './entities/notify-rule.entity'
import { NotifyTemplateEntity } from './entities/notify-template.entity'
import { NotifyController } from './notify.controller'
import { NotifyRuleService } from './notify-rule.service'
import { NotifyService } from './notify.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationEntity, NotifyTemplateEntity, NotifyRuleEntity, UserEntity, UserRoleEntity]),
    AuditModule
  ],
  controllers: [NotifyController],
  providers: [NotifyService, NotifyRuleService],
  exports: [NotifyService, NotifyRuleService, TypeOrmModule]
})
export class NotifyModule {}
