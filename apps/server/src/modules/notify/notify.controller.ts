import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  CreateNotificationDto,
  CreateNotifyRuleDto,
  CreateNotifyTemplateDto,
  DispatchNotifyEventDto,
  QueryNotificationDto,
  QueryNotifyRuleDto,
  QueryNotifySendRecordDto,
  SendByTemplateDto,
  TestNotifyChannelDto,
  UpdateNotificationDto,
  UpdateNotifyRuleDto,
  UpdateNotifyTemplateDto
} from './dto'
import { NotifyRuleService } from './notify-rule.service'
import { NotifyService } from './notify.service'

@Controller('system/notify')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'SELF' })
export class NotifyController {
  constructor(
    private readonly service: NotifyService,
    private readonly ruleService: NotifyRuleService
  ) {}

  @Get()
  @RequirePerm('system:notify:view')
  list(@Query() query: QueryNotificationDto, @CurrentUser() user: JwtUser) {
    return this.service.list(query, user)
  }

  @Post()
  @RequirePerm('system:notify:create')
  create(@Body() dto: CreateNotificationDto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user)
  }

  @Put(':id/read')
  @RequirePerm('system:notify:update')
  markRead(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNotificationDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.markRead(id, dto, user)
  }

  @Post('templates')
  @RequirePerm('system:notify:create')
  createTemplate(@Body() dto: CreateNotifyTemplateDto, @CurrentUser() user: JwtUser) {
    return this.service.createTemplate(dto, user)
  }

  @Get('templates')
  @RequirePerm('system:notify:view')
  listTemplates(@CurrentUser() user: JwtUser) {
    return this.service.listTemplates(user)
  }

  @Put('templates/:id')
  @RequirePerm('system:notify:update')
  updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNotifyTemplateDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.updateTemplate(id, dto, user)
  }

  @Post('channels/test')
  @RequirePerm('system:notify:update')
  testChannel(@Body() dto: TestNotifyChannelDto, @CurrentUser() user: JwtUser) {
    return this.service.testChannel(dto, user)
  }

  @Post('send/:code')
  @RequirePerm('system:notify:create')
  sendByTemplate(@Param('code') code: string, @Body() dto: SendByTemplateDto, @CurrentUser() user: JwtUser) {
    return this.service.sendByTemplate(code, dto, user)
  }

  @Post(':id/retry')
  @RequirePerm('system:notify:update')
  retry(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.retryFailed(id, user)
  }

  @Get('send-records')
  @RequirePerm('system:notify:record:view')
  sendRecords(@Query() query: QueryNotifySendRecordDto, @CurrentUser() user: JwtUser) {
    return this.service.listSendRecords(query, user)
  }

  /** 通知规则列表 */
  @Get('rules')
  @RequirePerm('system:notify-rule:view')
  listRules(@Query() query: QueryNotifyRuleDto, @CurrentUser() user: JwtUser) {
    return this.ruleService.list(query, user)
  }

  /** 新增通知规则 */
  @Post('rules')
  @RequirePerm('system:notify-rule:create')
  createRule(@Body() dto: CreateNotifyRuleDto, @CurrentUser() user: JwtUser) {
    return this.ruleService.create(dto, user)
  }

  /** 更新通知规则 */
  @Put('rules/:id')
  @RequirePerm('system:notify-rule:update')
  updateRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNotifyRuleDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.ruleService.update(id, dto, user)
  }

  /** 删除通知规则 */
  @Delete('rules/:id')
  @RequirePerm('system:notify-rule:delete')
  removeRule(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.ruleService.remove(id, user)
  }

  /** 事件通知派发：按规则匹配模板与接收人后投递 */
  @Post('dispatch/:eventType')
  @RequirePerm('system:notify:create')
  dispatch(
    @Param('eventType') eventType: string,
    @Body() dto: DispatchNotifyEventDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.dispatchByEvent(eventType, dto, user)
  }
}
