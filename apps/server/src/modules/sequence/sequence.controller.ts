import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { CreateSequenceDto, NextSequenceDto, QuerySequenceDto, UpdateSequenceDto } from './dto'
import { SequenceService } from './sequence.service'

@Controller('system/sequence')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'ORG' })
export class SequenceController {
  constructor(private readonly service: SequenceService) {}

  @Get()
  @RequirePerm('system:sequence:view')
  list(@Query() query: QuerySequenceDto, @CurrentUser() user: JwtUser) {
    return this.service.list(query, user)
  }

  @Post()
  @RequirePerm('system:sequence:create')
  create(@Body() dto: CreateSequenceDto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user)
  }

  @Put(':id')
  @RequirePerm('system:sequence:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSequenceDto, @CurrentUser() user: JwtUser) {
    return this.service.update(id, dto, user)
  }

  @Delete(':id')
  @RequirePerm('system:sequence:delete')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.remove(id, user)
  }

  @Post('next')
  @RequirePerm('system:sequence:next')
  next(@Body() dto: NextSequenceDto, @CurrentUser() user: JwtUser) {
    return this.service.next(dto, user)
  }

  @Get('preview/:bizCode')
  @RequirePerm('system:sequence:view')
  preview(@Param('bizCode') bizCode: string, @CurrentUser() user: JwtUser) {
    return this.service.preview(bizCode, user)
  }
}
