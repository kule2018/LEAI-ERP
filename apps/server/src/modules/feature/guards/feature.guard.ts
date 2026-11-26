import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import type { JwtUser } from '../../../common/contracts'
import { FEATURE_KEY } from '../decorators/require-feature.decorator'
import { FeatureService } from '../feature.service'

interface FeatureRequest extends Request {
  user?: JwtUser
}

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureService: FeatureService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const code = this.reflector.getAllAndOverride<string | undefined>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass()
    ])
    if (!code) return true
    const request = context.switchToHttp().getRequest<FeatureRequest>()
    if (!request.user) return true
    if (!(await this.featureService.isEnabled(code, request.user))) {
      throw new ForbiddenException(`功能未开启：${code}`)
    }
    return true
  }
}
