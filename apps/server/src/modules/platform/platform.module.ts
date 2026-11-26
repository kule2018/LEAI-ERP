import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MenuEntity } from './entities/menu.entity'
import { PermissionEntity } from './entities/permission.entity'
import { RoleEntity } from './entities/role.entity'
import { RolePermissionEntity } from './entities/role-permission.entity'
import { TenantEntity } from './entities/tenant.entity'
import { UserEntity } from './entities/user.entity'
import { UserRoleEntity } from './entities/user-role.entity'
import { PlatformSeederService } from './platform-seeder.service'
import { PrintTemplateEntity } from '../print/entities/print-template.entity'
import { AccountSubjectEntity } from '../finance/entities/finance.entities'

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
      PrintTemplateEntity,
      AccountSubjectEntity
    ])
  ],
  providers: [PlatformSeederService],
  exports: [TypeOrmModule]
})
export class PlatformModule {}
