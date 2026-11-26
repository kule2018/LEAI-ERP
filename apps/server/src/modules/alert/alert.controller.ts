import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ALERT_DEFAULT_THRESHOLDS, resolveAlertThresholds } from '../../common/alert-rule-engine'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { AlertService } from './alert.service'
import { CreateAlertRuleDto, QueryAlertRuleDto, UpdateAlertRuleDto } from './dto'

@Controller('alert')
@UseGuards(AuthGuard, PermissionsGuard)
export class AlertController {
  constructor(private readonly service: AlertService) {}

  @Get('rules/thresholds')
  @RequirePerm('system:alert-rule:view')
  async thresholds(@Query('bizType') bizType: string | undefined, @CurrentUser() user: JwtUser) {
    const rules = await this.service.definitions(user.tenantId, bizType)
    return {
      bizType: bizType ?? null,
      thresholds: resolveAlertThresholds(rules, Object.keys(ALERT_DEFAULT_THRESHOLDS))
    }
  }

  @Get('rules')
  @RequirePerm('system:alert-rule:view')
  list(@Query() query: QueryAlertRuleDto, @CurrentUser() user: JwtUser) {
    return this.service.list(query, user)
  }

  @Post('rules')
  @RequirePerm('system:alert-rule:create')
  create(@Body() dto: CreateAlertRuleDto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user)
  }

  @Put('rules/:id')
  @RequirePerm('system:alert-rule:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAlertRuleDto, @CurrentUser() user: JwtUser) {
    return this.service.update(id, dto, user)
  }

  @Delete('rules/:id')
  @RequirePerm('system:alert-rule:delete')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.remove(id, user)
  }
}
