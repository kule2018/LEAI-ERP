import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { DictService } from './dict.service'
import {
  CreateDictDto,
  CreateDictItemDto,
  QueryDictDto,
  QueryDictItemDto,
  UpdateDictDto,
  UpdateDictItemDto
} from './dto'

@Controller('system/dict')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'ORG' })
export class DictController {
  constructor(private readonly service: DictService) {}

  @Get()
  @RequirePerm('system:dict:view')
  listTypes(@Query() query: QueryDictDto, @CurrentUser() user: JwtUser) {
    return this.service.listTypes(query, user)
  }

  @Post()
  @RequirePerm('system:dict:create')
  createType(@Body() dto: CreateDictDto, @CurrentUser() user: JwtUser) {
    return this.service.createType(dto, user)
  }

  @Put(':id')
  @RequirePerm('system:dict:update')
  updateType(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDictDto, @CurrentUser() user: JwtUser) {
    return this.service.updateType(id, dto, user)
  }

  @Delete(':id')
  @RequirePerm('system:dict:delete')
  removeType(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeType(id, user)
  }

  @Get('items')
  @RequirePerm('system:dict:view')
  listItems(@Query() query: QueryDictItemDto, @CurrentUser() user: JwtUser) {
    return this.service.listItems(query, user)
  }

  @Post('items')
  @RequirePerm('system:dict:create')
  createItem(@Body() dto: CreateDictItemDto, @CurrentUser() user: JwtUser) {
    return this.service.createItem(dto, user)
  }

  @Put('items/:id')
  @RequirePerm('system:dict:update')
  updateItem(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDictItemDto, @CurrentUser() user: JwtUser) {
    return this.service.updateItem(id, dto, user)
  }

  @Delete('items/:id')
  @RequirePerm('system:dict:delete')
  removeItem(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeItem(id, user)
  }

  @Get('options/:dictType')
  @RequirePerm('system:dict:view')
  options(@Param('dictType') dictType: string, @CurrentUser() user: JwtUser) {
    return this.service.resolveItems(dictType, user.tenantId)
  }

  /** 字典导出 CSV（带 BOM，Excel 可直接打开） */
  @Get('export')
  @RequirePerm('system:dict:view')
  exportDict(@CurrentUser() user: JwtUser) {
    return this.service.exportDictCsv(user)
  }

  /** 字典导入（CSV 内容） */
  @Post('import')
  @RequirePerm('system:dict:create')
  importDict(@Body() body: { content: string; dryRun?: boolean }, @CurrentUser() user: JwtUser) {
    return this.service.importDictCsv(body.content, body.dryRun === true, user)
  }
}
