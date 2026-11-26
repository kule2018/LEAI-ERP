import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { QueryRevisionSnapshotDto, RecordRevisionSnapshotDto } from './dto'
import { RevisionService } from './revision.service'

@Controller('revision')
@UseGuards(AuthGuard, PermissionsGuard)
export class RevisionController {
  constructor(private readonly service: RevisionService) {}

  @Get('snapshots')
  @RequirePerm('system:revision:view')
  list(@Query() query: QueryRevisionSnapshotDto, @CurrentUser() user: JwtUser) {
    return this.service.list(query, user)
  }

  @Get('snapshots/:id')
  @RequirePerm('system:revision:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.detail(id, user)
  }

  @Get('snapshots/:id/diff/:targetId')
  @RequirePerm('system:revision:view')
  diff(
    @Param('id', ParseIntPipe) id: number,
    @Param('targetId', ParseIntPipe) targetId: number,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.diff(id, targetId, user)
  }

  @Get('history/:entityCode/:bizId')
  @RequirePerm('system:revision:view')
  history(
    @Param('entityCode') entityCode: string,
    @Param('bizId', ParseIntPipe) bizId: number,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.history(user.tenantId, entityCode, bizId)
  }

  @Post('snapshots')
  @RequirePerm('system:revision:create')
  record(@Body() dto: RecordRevisionSnapshotDto, @CurrentUser() user: JwtUser) {
    return this.service.record(dto, user)
  }
}
