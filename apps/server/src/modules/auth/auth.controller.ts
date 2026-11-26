import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { AuthService } from './auth.service'
import { ChangePasswordDto, LoginDto, MfaCodeDto, QueryLoginLogDto, RefreshDto, SsoCallbackDto } from './dto'

interface RequestLike {
  ip?: string
  headers?: Record<string, string | string[] | undefined>
}

@Controller('auth')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: RequestLike) {
    const rawAgent = req.headers?.['user-agent']
    const userAgent = Array.isArray(rawAgent) ? rawAgent[0] : rawAgent
    return this.authService.login(dto, { ip: req.ip, userAgent })
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto)
  }

  @Post('logout')
  logout(@CurrentUser() user: JwtUser) {
    return this.authService.logout(user)
  }

  /** 自助修改密码 */
  @Post('change-password')
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: JwtUser) {
    return this.authService.changePassword(dto, user)
  }

  /** 登录日志查询 */
  @Get('login-logs')
  @RequirePerm('system:login-log:view')
  listLoginLogs(@Query() query: QueryLoginLogDto, @CurrentUser() user: JwtUser) {
    return this.authService.listLoginLogs(query, user)
  }

  @Get('me')
  profile(@CurrentUser() user: JwtUser) {
    return this.authService.profile(user)
  }

  @Get('menus')
  menus(@CurrentUser() user: JwtUser) {
    return this.authService.menus(user)
  }

  /** 高风险登录验证码（文本 SVG，无需图片库） */
  @Public()
  @Post('captcha')
  captcha() {
    return this.authService.createCaptcha()
  }

  /** SSO：生成授权跳转地址 */
  @Public()
  @Get('sso/authorize')
  ssoAuthorize(@Query('tenantCode') tenantCode?: string) {
    return this.authService.ssoAuthorize(tenantCode || 'default')
  }

  /** SSO：回调换取 ERP 令牌 */
  @Public()
  @Post('sso/callback')
  ssoCallback(@Body() dto: SsoCallbackDto) {
    return this.authService.ssoCallback(dto)
  }

  @Post('mfa/setup')
  setupMfa(@CurrentUser() user: JwtUser) {
    return this.authService.setupMfa(user)
  }

  @Post('mfa/verify')
  verifyMfa(@Body() dto: MfaCodeDto, @CurrentUser() user: JwtUser) {
    return this.authService.verifyMfaSetup(user, dto.code)
  }

  @Post('mfa/disable')
  disableMfa(@Body() dto: MfaCodeDto, @CurrentUser() user: JwtUser) {
    return this.authService.disableMfa(user, dto.code)
  }
}
