import { Controller, Get, UseGuards } from '@nestjs/common'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { DocsService } from './docs.service'

@Controller('docs')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'ORG' })
export class DocsController {
  constructor(private readonly service: DocsService) {}

  @Get('api')
  @RequirePerm('system:permission:view')
  listApi() {
    return this.service.listApi()
  }

  @Get('permissions')
  @RequirePerm('system:permission:view')
  listPermissions() {
    return this.service.listPermissions()
  }
}
