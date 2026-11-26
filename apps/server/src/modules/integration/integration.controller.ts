import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  CreateIntegrationDto,
  QueryIntegrationDto,
  SendTodoDto,
  UpdateIntegrationDto
} from './dto'
import { IntegrationService } from './integration.service'

@Controller('integration')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'ORG' })
export class IntegrationController {
  constructor(private readonly service: IntegrationService) {}

  @Get('configs')
  @RequirePerm('system:integration:view')
  listConfigs(@Query() query: QueryIntegrationDto, @CurrentUser() user: JwtUser) {
    return this.service.listConfigs(query, user)
  }

  @Post('configs')
  @RequirePerm('system:integration:create')
  upsertConfig(@Body() dto: CreateIntegrationDto, @CurrentUser() user: JwtUser) {
    return this.service.upsertConfig(dto, user)
  }

  @Put('configs/:id')
  @RequirePerm('system:integration:update')
  updateConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIntegrationDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.updateConfig(id, dto, user)
  }

  @Delete('configs/:id')
  @RequirePerm('system:integration:delete')
  removeConfig(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeConfig(id, user)
  }

  @Get('messages')
  @RequirePerm('system:integration:view')
  listMessages(@Query() query: QueryIntegrationDto, @CurrentUser() user: JwtUser) {
    return this.service.listMessages(query, user)
  }

  @Post('todos/:channel')
  @RequirePerm('system:integration:create')
  sendTodo(
    @Param('channel') channel: 'WECHAT' | 'DINGTALK',
    @Body() dto: SendTodoDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.sendTodo(channel, dto, user)
  }
}
