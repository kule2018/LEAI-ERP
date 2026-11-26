import { SetMetadata } from '@nestjs/common'

export const REQUIRE_PERM_KEY = 'requirePerm'

export function RequirePerm(perm: string): MethodDecorator & ClassDecorator {
  return SetMetadata(REQUIRE_PERM_KEY, perm)
}
