import { SetMetadata } from '@nestjs/common'

export const API_SCOPE_KEY = 'apiScope'

export function RequireApiScope(scope: string): MethodDecorator & ClassDecorator {
  return SetMetadata(API_SCOPE_KEY, scope)
}
