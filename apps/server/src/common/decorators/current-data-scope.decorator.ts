import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { DataScopeInfo } from '../contracts'

export const CurrentDataScope = createParamDecorator((_data: unknown, context: ExecutionContext): DataScopeInfo => {
  const request = context.switchToHttp().getRequest<{ dataScope: DataScopeInfo }>()
  return request.dataScope
})
