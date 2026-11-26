import { SetMetadata } from '@nestjs/common'

export const PUBLIC_KEY = 'isPublic'

export function Public(): MethodDecorator & ClassDecorator {
  return SetMetadata(PUBLIC_KEY, true)
}
