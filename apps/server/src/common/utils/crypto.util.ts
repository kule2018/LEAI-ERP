import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { env } from '../../config/env'

const ALGORITHM = 'aes-256-gcm'
const PREFIX = 'enc:v1'

function deriveKey(): Buffer {
  return scryptSync(env.jwt.secret, 'leaierp-webhook-secret', 32)
}

export function sealSecret(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, deriveKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function unsealSecret(payload: string | null | undefined): string | null {
  if (!payload || !payload.startsWith(`${PREFIX}:`)) return null
  const parts = payload.split(':')
  if (parts.length !== 5) return null
  try {
    const iv = Buffer.from(parts[2] ?? '', 'hex')
    const tag = Buffer.from(parts[3] ?? '', 'hex')
    const encrypted = Buffer.from(parts[4] ?? '', 'hex')
    const decipher = createDecipheriv(ALGORITHM, deriveKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

export function maskSecret(value: string): string {
  if (value.length <= 8) return `${value.slice(0, 2)}****`
  return `${value.slice(0, 4)}****${value.slice(-4)}`
}
