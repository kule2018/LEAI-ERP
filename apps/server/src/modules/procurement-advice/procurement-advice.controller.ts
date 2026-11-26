import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { AddQuoteDto, ConfirmAdviceDto, QueryAdviceDto, StartAdviceDto } from './dto'
import { ProcurementAdviceService } from './procurement-advice.service'

@Controller('procurement-advice')
@UseGuards(AuthGuard, PermissionsGuard)
export class ProcurementAdviceController {
  constructor(private readonly service: ProcurementAdviceService) {}

  @Get()
  @RequirePerm('procurement:advice:view')
  list(@Query() query: QueryAdviceDto, @CurrentUser() user: JwtUser) {
    return this.service.list(query, user)
  }

  @Get('metrics')
  @RequirePerm('procurement:advice:view')
  metrics(@CurrentUser() user: JwtUser) {
    return this.service.metrics(user)
  }

  @Get(':id')
  @RequirePerm('procurement:advice:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.detail(id, user)
  }

  @Post()
  @RequirePerm('procurement:advice:create')
  start(@Body() dto: StartAdviceDto, @CurrentUser() user: JwtUser) {
    return this.service.start(dto, user)
  }

  @Post(':id/pause')
  @RequirePerm('procurement:advice:create')
  pause(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.pause(id, user)
  }

  @Post(':id/resume')
  @RequirePerm('procurement:advice:create')
  resume(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.resume(id, user)
  }

  @Post(':id/remind')
  @RequirePerm('procurement:advice:create')
  remind(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.remind(id, user)
  }

  @Post(':id/quotes')
  @RequirePerm('procurement:advice:create')
  addQuote(@Param('id', ParseIntPipe) id: number, @Body() dto: AddQuoteDto, @CurrentUser() user: JwtUser) {
    return this.service.addQuote(id, dto, user)
  }

  @Post(':id/confirm')
  @RequirePerm('procurement:advice:confirm')
  confirm(@Param('id', ParseIntPipe) id: number, @Body() dto: ConfirmAdviceDto, @CurrentUser() user: JwtUser) {
    return this.service.confirm(id, dto, user)
  }
}
