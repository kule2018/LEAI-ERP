import { SetMetadata } from '@nestjs/common'
import type { DataScopeLevel } from '../contracts'

export const DATA_SCOPE_KEY = 'dataScope'

export interface DataScopeOption {
  org: 'dept' | 'org' | 'created_by'
  level: DataScopeLevel
  bizType?: string
}

export function DataScope(option: DataScopeOption): MethodDecorator & ClassDecorator {
  return SetMetadata(DATA_SCOPE_KEY, option)
}
