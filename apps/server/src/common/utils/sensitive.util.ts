import { maskSecret, sealSecret, unsealSecret } from './crypto.util'
import { isSensitiveField } from '../export-guard-engine'

export interface SealedFields {
  encrypted: Record<string, string>
  masked: Record<string, string>
}

/** 统一敏感字段加密入口：按字段名识别并返回密文与掩码，供实体双列存储。 */
export function sealSensitiveFields(input: Record<string, unknown>, fields?: string[]): SealedFields {
  const encrypted: Record<string, string> = {}
  const masked: Record<string, string> = {}
  const keys = fields ?? Object.keys(input)
  for (const key of keys) {
    const value = input[key]
    if (value == null || value === '') continue
    if (fields ? true : !isSensitiveField(key)) continue
    const text = String(value)
    encrypted[`${key}Encrypted`] = sealSecret(text)
    masked[`${key}Mask`] = maskSecret(text)
  }
  return { encrypted, masked }
}

export function unsealSensitiveField(payload: string | null | undefined): string {
  return payload ? unsealSecret(payload) ?? '' : ''
}
