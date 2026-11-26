import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { MenuEntity } from '../platform/entities/menu.entity'
import { PermissionEntity } from '../platform/entities/permission.entity'
import { RoleEntity } from '../platform/entities/role.entity'
import { RolePermissionEntity } from '../platform/entities/role-permission.entity'
import { TenantEntity } from '../platform/entities/tenant.entity'
import { UserEntity } from '../platform/entities/user.entity'
import { UserRoleEntity } from '../platform/entities/user-role.entity'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { LoginLogEntity } from './entities/login-log.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantEntity,
      UserEntity,
      RoleEntity,
      PermissionEntity,
      MenuEntity,
      UserRoleEntity,
      RolePermissionEntity,
      LoginLogEntity
    ]),
    JwtModule.register({}),
    AuditModule
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}
