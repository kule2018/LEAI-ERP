import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { RequireApiScope } from './decorators/require-api-scope.decorator'
import {
  CreateApiKeyDto,
  CreateWebhookDto,
  PublishEventDto,
  QueryOpenApiDto,
  UpdateStatusDto,
  UpdateWebhookDto
} from './dto'
import { ApiKeyGuard } from './guards/api-key.guard'
import { OpenApiService } from './openapi.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

@Controller('openapi')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class OpenApiController {
  constructor(private readonly service: OpenApiService) {}

  @Get('keys')
  @RequirePerm('system:openapi:view')
  listKeys(@Query() query: QueryOpenApiDto, @CurrentUser() user: JwtUser) {
    return this.service.listApiKeys(query, user)
  }

  @Get('call-logs')
  @RequirePerm('system:openapi:view')
  callLogs(@Query() query: QueryOpenApiDto & { apiKeyId?: number }, @CurrentUser() user: JwtUser) {
    return this.service.listCallLogs(query, user)
  }

  @Post('keys')
  @RequirePerm('system:openapi:create')
  createKey(@Body() dto: CreateApiKeyDto, @CurrentUser() user: JwtUser) {
    return this.service.createApiKey(dto, user)
  }

  @Post('keys/:id/rotate')
  @RequirePerm('system:openapi:update')
  rotateKey(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.rotateApiKey(id, user)
  }

  @Put('keys/:id/status')
  @RequirePerm('system:openapi:update')
  setKeyStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.setApiKeyStatus(id, dto.status, user)
  }

  @Delete('keys/:id')
  @RequirePerm('system:openapi:delete')
  removeKey(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeApiKey(id, user)
  }

  @Get('webhooks')
  @RequirePerm('system:openapi:view')
  listWebhooks(@Query() query: QueryOpenApiDto, @CurrentUser() user: JwtUser) {
    return this.service.listWebhooks(query, user)
  }

  @Post('webhooks')
  @RequirePerm('system:openapi:create')
  createWebhook(@Body() dto: CreateWebhookDto, @CurrentUser() user: JwtUser) {
    return this.service.createWebhook(dto, user)
  }

  @Put('webhooks/:id')
  @RequirePerm('system:openapi:update')
  updateWebhook(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWebhookDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.updateWebhook(id, dto, user)
  }

  @Delete('webhooks/:id')
  @RequirePerm('system:openapi:delete')
  removeWebhook(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeWebhook(id, user)
  }

  @Get('deliveries')
  @RequirePerm('system:openapi:view')
  listDeliveries(@Query() query: QueryOpenApiDto, @CurrentUser() user: JwtUser) {
    return this.service.listDeliveries(query, user)
  }

  @Post('deliveries/:id/retry')
  @RequirePerm('system:openapi:update')
  retryDelivery(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.retryDelivery(id, user)
  }

  @Post('events/publish')
  @RequirePerm('system:openapi:create')
  publish(@Body() dto: PublishEventDto, @CurrentUser() user: JwtUser) {
    return this.service.publishEvent(dto, user)
  }
}

@Controller('openapi/external')
@UseGuards(ApiKeyGuard)
export class OpenApiExternalController {
  constructor(private readonly service: OpenApiService) {}

  @Post('events')
  @RequireApiScope('event:publish')
  publish(@Body() dto: PublishEventDto, @CurrentUser() user: JwtUser) {
    return this.service.publishEvent(dto, user)
  }
}
