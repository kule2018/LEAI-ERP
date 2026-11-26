import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { QueryLangDto, UpsertLangDto } from './system-lang.dto'
import { SystemLangService } from './system-lang.service'

@Controller('system/lang')
@UseGuards(AuthGuard, PermissionsGuard)
export class SystemLangController {
  constructor(private readonly service: SystemLangService) {}

  @Get('list')
  @RequirePerm('system:lang:view')
  list(@Query() query: QueryLangDto, @CurrentUser() user: JwtUser) {
    return this.service.list(query, user)
  }

  @Get('packages')
  @RequirePerm('system:lang:view')
  packages(@CurrentUser() user: JwtUser) {
    return this.service.packages(user)
  }

  @Post('upsert')
  @RequirePerm('system:lang:update')
  upsert(@Body() dto: UpsertLangDto, @CurrentUser() user: JwtUser) {
    return this.service.upsert(dto, user)
  }

  @Post('diff')
  @RequirePerm('system:lang:view')
  diff(@Body() body: { langCode: string; values: Record<string, string> }, @CurrentUser() user: JwtUser) {
    return this.service.diff(body.langCode, body.values ?? {}, user)
  }

  @Delete(':id')
  @RequirePerm('system:lang:update')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.remove(id, user)
  }
}
