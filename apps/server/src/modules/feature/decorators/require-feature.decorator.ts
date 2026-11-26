import { SetMetadata } from '@nestjs/common'

export const FEATURE_KEY = 'requireFeature'

export function RequireFeature(code: string): MethodDecorator & ClassDecorator {
  return SetMetadata(FEATURE_KEY, code)
}
