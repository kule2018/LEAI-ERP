import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64
const SALT_LENGTH = 16

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString('hex')
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `scrypt$${salt}$${derivedKey}`
}

export function comparePassword(password: string, stored: string): boolean {
  const [scheme, salt, expectedHex] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !expectedHex) {
    return false
  }

  const expected = Buffer.from(expectedHex, 'hex')
  const actual = scryptSync(password, salt, expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export interface PasswordPolicyOptions {
  minLength: number
  maxLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireDigit: boolean
  requireSymbol: boolean
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicyOptions = {
  minLength: 8,
  maxLength: 64,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: false
}

/** 校验密码强度，返回违规说明数组（空数组表示通过） */
export function validatePasswordPolicy(
  password: string,
  options: PasswordPolicyOptions = DEFAULT_PASSWORD_POLICY
): string[] {
  const errors: string[] = []
  if (!password || password.length < options.minLength) {
    errors.push(`密码长度不得少于 ${options.minLength} 位`)
  }
  if (password && password.length > options.maxLength) {
    errors.push(`密码长度不得超过 ${options.maxLength} 位`)
  }
  if (options.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('密码需包含大写字母')
  }
  if (options.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('密码需包含小写字母')
  }
  if (options.requireDigit && !/\d/.test(password)) {
    errors.push('密码需包含数字')
  }
  if (options.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('密码需包含特殊字符')
  }
  return errors
}
