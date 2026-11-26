import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { CustomFieldService } from './custom-field.service'
import {
  BatchCustomValuesDto,
  CreateCustomFieldDto,
  CreateCustomFormDto,
  QueryCustomFieldDto,
  QueryCustomFormDto,
  SaveCustomValuesDto,
  UpdateCustomFieldDto,
  UpdateCustomFormDto
} from './dto'

@Controller('customization')
@UseGuards(AuthGuard, PermissionsGuard)
export class CustomFieldController {
  constructor(private readonly service: CustomFieldService) {}

  @Get('fields')
  @RequirePerm('system:custom-field:view')
  listFields(@Query() query: QueryCustomFieldDto, @CurrentUser() user: JwtUser) {
    return this.service.listFields(query, user)
  }

  @Post('fields')
  @RequirePerm('system:custom-field:create')
  createField(@Body() dto: CreateCustomFieldDto, @CurrentUser() user: JwtUser) {
    return this.service.createField(dto, user)
  }

  @Put('fields/:id')
  @RequirePerm('system:custom-field:update')
  updateField(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomFieldDto, @CurrentUser() user: JwtUser) {
    return this.service.updateField(id, dto, user)
  }

  @Delete('fields/:id')
  @RequirePerm('system:custom-field:delete')
  removeField(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeField(id, user)
  }

  @Get('forms')
  @RequirePerm('system:custom-form:view')
  listForms(@Query() query: QueryCustomFormDto, @CurrentUser() user: JwtUser) {
    return this.service.listForms(query, user)
  }

  @Post('forms')
  @RequirePerm('system:custom-form:create')
  createForm(@Body() dto: CreateCustomFormDto, @CurrentUser() user: JwtUser) {
    return this.service.createForm(dto, user)
  }

  @Put('forms/:id')
  @RequirePerm('system:custom-form:update')
  updateForm(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomFormDto, @CurrentUser() user: JwtUser) {
    return this.service.updateForm(id, dto, user)
  }

  @Delete('forms/:id')
  @RequirePerm('system:custom-form:delete')
  removeForm(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeForm(id, user)
  }

  @Get('schema/:entityCode')
  @RequirePerm('system:custom-field:view')
  schema(@Param('entityCode') entityCode: string, @CurrentUser() user: JwtUser) {
    return this.service.schema(entityCode, user)
  }

  @Get('values/:entityCode/:bizId')
  @RequirePerm('system:custom-field:view')
  values(
    @Param('entityCode') entityCode: string,
    @Param('bizId', ParseIntPipe) bizId: number,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.values(entityCode, bizId, user)
  }

  @Post('values/batch')
  @RequirePerm('system:custom-field:view')
  valuesBatch(@Body() dto: BatchCustomValuesDto, @CurrentUser() user: JwtUser) {
    return this.service.valuesBatch(dto.entityCode, dto.bizIds ?? [], user)
  }

  @Put('values/:entityCode/:bizId')
  @RequirePerm('system:custom-field:update')
  saveValues(
    @Param('entityCode') entityCode: string,
    @Param('bizId', ParseIntPipe) bizId: number,
    @Body() dto: SaveCustomValuesDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.saveValues(entityCode, bizId, dto, user)
  }
}
