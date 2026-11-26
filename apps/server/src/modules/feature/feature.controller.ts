import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { CreateFeatureDto, QueryFeatureDto, UpdateFeatureDto } from './dto'
import { FeatureService } from './feature.service'

@Controller('system/features')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'ORG' })
export class FeatureController {
  constructor(private readonly service: FeatureService) {}

  @Get()
  @RequirePerm('system:feature:view')
  list(@Query() query: QueryFeatureDto, @CurrentUser() user: JwtUser) {
    return this.service.list(query, user)
  }

  @Get(':id/impact')
  @RequirePerm('system:feature:view')
  impact(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.impact(id, user)
  }

  @Get('check/:code')
  @RequirePerm('system:feature:view')
  check(@Param('code') code: string, @CurrentUser() user: JwtUser) {
    return this.service.check(code, user)
  }

  @Post()
  @RequirePerm('system:feature:create')
  upsert(@Body() dto: CreateFeatureDto, @CurrentUser() user: JwtUser) {
    return this.service.upsert(dto, user)
  }

  @Put(':id')
  @RequirePerm('system:feature:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFeatureDto, @CurrentUser() user: JwtUser) {
    return this.service.update(id, dto, user)
  }

  @Delete(':id')
  @RequirePerm('system:feature:delete')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.remove(id, user)
  }
}
