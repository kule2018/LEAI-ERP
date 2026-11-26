import path from 'node:path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') })

function toNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toNumber(process.env.PORT, 3000),
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: toNumber(process.env.DB_PORT, 3306),
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? 'leaierp_dev',
    database: process.env.DB_DATABASE ?? 'leaierp'
  },
  redis: {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: toNumber(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined
  },
  rateLimit: {
    windowMs: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: toNumber(process.env.RATE_LIMIT_MAX, 300)
  },
  storage: {
    /** LOCAL | S3（MinIO / OSS S3 兼容端点） */
    driver: process.env.STORAGE_DRIVER ?? 'LOCAL',
    localRoot: process.env.STORAGE_LOCAL_ROOT || path.resolve(process.cwd(), 'uploads'),
    s3: {
      endpoint: process.env.S3_ENDPOINT || null,
      region: process.env.S3_REGION ?? 'us-east-1',
      bucket: process.env.S3_BUCKET || 'leaierp',
      accessKey: process.env.S3_ACCESS_KEY || null,
      secretKey: process.env.S3_SECRET_KEY || null,
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || null
    }
  },
  websocket: {
    enabled: (process.env.WEBSOCKET_ENABLED ?? 'true') === 'true',
    path: process.env.WEBSOCKET_PATH ?? '/ws',
    maxConnections: toNumber(process.env.WEBSOCKET_MAX_CONNECTIONS, 2000)
  },
  observability: {
    sentryDsn: process.env.SENTRY_DSN || null,
    logLevel: process.env.LOG_LEVEL ?? 'info',
    prometheusEnabled: (process.env.PROMETHEUS_ENABLED ?? 'true') === 'true'
  },
  security: {
    ssoIssuer: process.env.SSO_ISSUER || null,
    ssoClientId: process.env.SSO_CLIENT_ID || null,
    ssoClientSecret: process.env.SSO_CLIENT_SECRET || null,
    ssoCallbackUrl: process.env.SSO_CALLBACK_URL || null,
    ssoTokenUrl: process.env.SSO_TOKEN_URL || null,
    ssoUserinfoUrl: process.env.SSO_USERINFO_URL || null,
    mfaIssuer: process.env.MFA_ISSUER ?? 'LEAIERP',
    captchaTtlSeconds: toNumber(process.env.CAPTCHA_TTL_SECONDS, 180)
  },
  fx: {
    provider: process.env.FX_PROVIDER ?? 'ECB',
    url: process.env.FX_URL ?? 'https://api.frankfurter.app/latest?from=CNY',
    cacheTtlSeconds: toNumber(process.env.FX_CACHE_TTL_SECONDS, 3600)
  },
  pdf: {
    fontPath: process.env.PDF_FONT_PATH || null
  },
  notify: {
    /** 外部渠道投递网关（未配置时仅落库待投递） */
    emailGatewayUrl: process.env.NOTIFY_EMAIL_GATEWAY_URL || null,
    smsGatewayUrl: process.env.NOTIFY_SMS_GATEWAY_URL || null,
    wecomGatewayUrl: process.env.NOTIFY_WECOM_GATEWAY_URL || null,
    dingtalkGatewayUrl: process.env.NOTIFY_DINGTALK_GATEWAY_URL || null,
    emailSender: process.env.NOTIFY_EMAIL_SENDER || null,
    smsSender: process.env.NOTIFY_SMS_SENDER || null,
    gatewayToken: process.env.NOTIFY_GATEWAY_TOKEN || null,
    timeoutMs: toNumber(process.env.NOTIFY_TIMEOUT_MS, 5000)
  },
  slowSql: {
    /** 慢 SQL 采集阈值（毫秒） */
    thresholdMs: toNumber(process.env.SLOW_SQL_THRESHOLD_MS, 500),
    /** 内存中保留的慢 SQL 条数 */
    keepSize: toNumber(process.env.SLOW_SQL_KEEP_SIZE, 200)
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'leaierp_dev_secret_change_me',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '2h',
    refreshTtlSeconds: toNumber(process.env.JWT_REFRESH_TTL_SECONDS, 604800)
  },
  initialAdmin: {
    username: process.env.INITIAL_ADMIN_USERNAME ?? 'admin',
    password: process.env.INITIAL_ADMIN_PASSWORD ?? 'Admin@123456',
    realName: process.env.INITIAL_ADMIN_REAL_NAME ?? '系统管理员'
  }
}
