import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { DataScopeService } from './data-scope.service'
import { CreateDataScopeDto, QueryDataScopeDto, UpdateDataScopeDto } from './dto'

@Controller('system/data-scope')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'ORG' })
export class DataScopeController {
  constructor(private readonly service: DataScopeService) {}

  @Get()
  @RequirePerm('system:data-scope:view')
  list(@Query() query: QueryDataScopeDto, @CurrentUser() user: JwtUser) {
    return this.service.list(query, user)
  }

  @Get('preview/:bizType')
  @RequirePerm('system:data-scope:view')
  preview(@Param('bizType') bizType: string, @CurrentUser() user: JwtUser) {
    return this.service.preview(bizType, user)
  }

  @Post()
  @RequirePerm('system:data-scope:create')
  create(@Body() dto: CreateDataScopeDto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user)
  }

  @Put(':id')
  @RequirePerm('system:data-scope:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDataScopeDto, @CurrentUser() user: JwtUser) {
    return this.service.update(id, dto, user)
  }

  @Delete(':id')
  @RequirePerm('system:data-scope:delete')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.remove(id, user)
  }
}
