import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { MenuEntity } from '../platform/entities/menu.entity'
import { PermissionEntity } from '../platform/entities/permission.entity'
import { RoleEntity } from '../platform/entities/role.entity'
import { RolePermissionEntity } from '../platform/entities/role-permission.entity'
import { UserEntity } from '../platform/entities/user.entity'
import { UserRoleEntity } from '../platform/entities/user-role.entity'
import { SystemController } from './system.controller'
import { SystemService } from './system.service'
import { CompanyEntity, DeptEntity, OrgEntity, PositionEntity } from './entities/org.entities'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyEntity,
      OrgEntity,
      DeptEntity,
      PositionEntity,
      UserEntity,
      RoleEntity,
      PermissionEntity,
      MenuEntity,
      UserRoleEntity,
      RolePermissionEntity
    ]),
    AuditModule
  ],
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService, TypeOrmModule]
})
export class SystemModule {}
