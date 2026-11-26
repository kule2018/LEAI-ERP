import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  CreateStockIoAttachmentDto, CreateStockIoDto, PostStockIoDto, QueryStockIoDto, ReverseStockIoDto
} from './dto'
import { StockIoService } from './stock-io.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

@Controller('inventory/io-doc')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class StockIoController {
  constructor(private readonly service: StockIoService) {}

  @Get('types')
  @RequirePerm('inventory:io-doc:view')
  types() {
    return this.service.types()
  }

  @Get()
  @RequirePerm('inventory:io-doc:view')
  list(@Query() query: QueryStockIoDto, @CurrentUser() user: JwtUser) {
    return this.service.list(query, user)
  }

  @Get(':id')
  @RequirePerm('inventory:io-doc:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.detail(id, user)
  }

  @Post()
  @RequirePerm('inventory:io-doc:create')
  create(@Body() dto: CreateStockIoDto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user)
  }

  @Post(':id/post')
  @RequirePerm('inventory:io-doc:post')
  post(@Param('id', ParseIntPipe) id: number, @Body() dto: PostStockIoDto, @CurrentUser() user: JwtUser) {
    return this.service.post(id, dto, user)
  }

  @Post(':id/reverse')
  @RequirePerm('inventory:io-doc:reverse')
  reverse(@Param('id', ParseIntPipe) id: number, @Body() dto: ReverseStockIoDto, @CurrentUser() user: JwtUser) {
    return this.service.reverse(id, dto, user)
  }

  @Post(':id/attachments')
  @RequirePerm('inventory:io-doc:create')
  attach(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateStockIoAttachmentDto, @CurrentUser() user: JwtUser) {
    return this.service.addAttachment(id, dto, user)
  }

  @Delete(':id/attachments/:attachmentId')
  @RequirePerm('inventory:io-doc:create')
  detach(
    @Param('id', ParseIntPipe) id: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.removeAttachment(id, attachmentId, user)
  }
}
