import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { CurrencyService } from './currency.service'

@Controller('currency')
@UseGuards(AuthGuard, PermissionsGuard)
export class CurrencyController {
  constructor(private readonly service: CurrencyService) {}

  @Post('rates')
  @RequirePerm('system:currency:update')
  setRate(@Body() body: { fromCurrency: string; toCurrency: string; rate: number; effectiveDate: string; reason?: string }, @CurrentUser() user: JwtUser) {
    return this.service.setRate(body, user)
  }

  @Get('rates')
  @RequirePerm('system:currency:view')
  list(@CurrentUser() user: JwtUser) {
    return this.service.list(user)
  }

  @Get('rate')
  @RequirePerm('system:currency:view')
  rate(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('date') date: string,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.getRate(from, to, date || new Date().toISOString().slice(0, 10), user)
  }

  @Post('rates/sync')
  @RequirePerm('system:currency:update')
  syncRates(@Query('base') base: string | undefined, @CurrentUser() user: JwtUser) {
    return this.service.syncExternalRates(user, base || 'CNY')
  }

  @Post('convert')
  @RequirePerm('system:currency:view')
  convert(
    @Body() body: { amount: number; from: string; to: string; date?: string },
    @CurrentUser() user: JwtUser
  ) {
    return this.service.convert(body.amount, body.from, body.to, body.date || new Date().toISOString().slice(0, 10), user)
  }

  @Post('to-base')
  @RequirePerm('system:currency:view')
  toBase(
    @Body() body: { items: Array<{ amount: number; currency: string }>; base: string; date?: string },
    @CurrentUser() user: JwtUser
  ) {
    return this.service.toBase(body.items, body.base, body.date || new Date().toISOString().slice(0, 10), user)
  }
}
