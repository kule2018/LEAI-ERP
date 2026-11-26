import { createHash, createHmac } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { env } from '../config/env'

export interface StoredObject {
  driver: string
  url: string | null
  signedUrl: string | null
}

function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest()
}

/**
 * 对象存储统一抽象：LOCAL 落盘（兼容历史数据），S3 兼容端点覆盖 MinIO / 阿里云 OSS。
 * 使用 Node 内置 crypto + fetch 实现 SigV4，无需额外 SDK 依赖。
 */
@Injectable()
export class ObjectStorageService {
  private readonly logger = new Logger(ObjectStorageService.name)
  private readonly driver = env.storage.driver.toUpperCase() === 'S3' ? 'S3' : 'LOCAL'

  async put(key: string, buffer: Buffer, contentType: string): Promise<StoredObject> {
    if (this.driver === 'LOCAL') {
      const target = this.localPath(key)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, buffer)
      return { driver: 'LOCAL', url: `/uploads/${key}`, signedUrl: `/uploads/${key}` }
    }
    const url = this.objectUrl(key)
    const response = await this.signedRequest('PUT', url, buffer, contentType)
    if (!response.ok) {
      throw new BadRequestException(`对象存储上传失败：${response.status} ${await response.text()}`)
    }
    return {
      driver: 'S3',
      url: env.storage.s3.publicBaseUrl ? `${env.storage.s3.publicBaseUrl}/${key}` : null,
      signedUrl: this.presignedUrl(key)
    }
  }

  async getSignedUrl(key: string, expiresSeconds = 900): Promise<string> {
    if (this.driver === 'LOCAL') return `/uploads/${key}`
    return this.presignedUrl(key, expiresSeconds)
  }

  async getObject(key: string): Promise<Buffer> {
    if (this.driver === 'LOCAL') return readFile(this.localPath(key))
    const response = await this.signedRequest('GET', this.objectUrl(key))
    if (!response.ok) throw new BadRequestException(`对象存储读取失败：${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }

  async remove(key: string): Promise<void> {
    if (this.driver === 'LOCAL') {
      await unlink(this.localPath(key)).catch(() => undefined)
      return
    }
    const response = await this.signedRequest('DELETE', this.objectUrl(key))
    if (!response.ok) this.logger.warn(`对象存储删除失败：${response.status} ${key}`)
  }

  private localPath(key: string): string {
    const root = path.resolve(env.storage.localRoot)
    const target = path.resolve(root, key)
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      throw new BadRequestException('非法的对象键')
    }
    return target
  }

  private s3Config(): { endpoint: string; region: string; bucket: string; accessKey: string; secretKey: string } {
    const cfg = env.storage.s3
    if (!cfg.endpoint || !cfg.accessKey || !cfg.secretKey) {
      throw new BadRequestException('对象存储未配置 S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY')
    }
    return {
      endpoint: cfg.endpoint.replace(/\/$/, ''),
      region: cfg.region,
      bucket: cfg.bucket,
      accessKey: cfg.accessKey,
      secretKey: cfg.secretKey
    }
  }

  private objectUrl(key: string): string {
    const cfg = this.s3Config()
    const encoded = key.split('/').map((segment) => encodeURIComponent(segment)).join('/')
    return cfg.endpoint.includes('{bucket}')
      ? cfg.endpoint.replace('{bucket}', cfg.bucket) + `/${encoded}`
      : `${cfg.endpoint}/${env.storage.s3.forcePathStyle ? `${cfg.bucket}/` : ''}${encoded}`
  }

  private async signedRequest(
    method: 'GET' | 'PUT' | 'DELETE',
    url: string,
    body?: Buffer,
    contentType?: string
  ): Promise<Response> {
    const cfg = this.s3Config()
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = amzDate.slice(0, 8)
    const target = new URL(url)
    const payloadHash = sha256Hex(body ?? '')
    const headers: Record<string, string> = {
      host: target.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate
    }
    if (contentType) headers['content-type'] = contentType
    const signature = this.signature({
      method,
      target,
      headers,
      payloadHash,
      amzDate,
      dateStamp,
      region: cfg.region,
      accessKey: cfg.accessKey,
      secretKey: cfg.secretKey
    })
    headers.authorization = signature
    return fetch(url, {
      method,
      headers,
      ...(body ? { body: new Uint8Array(body) } : {})
    })
  }

  private presignedUrl(key: string, expiresSeconds = 900): string {
    const cfg = this.s3Config()
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = amzDate.slice(0, 8)
    const target = new URL(this.objectUrl(key))
    const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`
    const params = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${cfg.accessKey}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresSeconds),
      'X-Amz-SignedHeaders': 'host'
    })
    const sorted = new URLSearchParams([...params.entries()].sort(([a], [b]) => a.localeCompare(b)))
    target.search = sorted.toString()
    const payloadHash = 'UNSIGNED-PAYLOAD'
    const canonicalRequest = [
      'GET',
      target.pathname,
      target.search.replace(/^\?/, ''),
      `host:${target.host}\n`,
      'host',
      payloadHash
    ].join('\n')
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      sha256Hex(canonicalRequest)
    ].join('\n')
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${cfg.secretKey}`, dateStamp), cfg.region), 's3'), 'aws4_request')
    sorted.set('X-Amz-Signature', hmac(signingKey, stringToSign).toString('hex'))
    target.search = sorted.toString()
    return target.toString()
  }

  private signature(input: {
    method: string
    target: URL
    headers: Record<string, string>
    payloadHash: string
    amzDate: string
    dateStamp: string
    region: string
    accessKey: string
    secretKey: string
  }): string {
    const signedHeaders = Object.keys(input.headers).sort()
    const canonicalHeaders = signedHeaders.map((key) => `${key}:${input.headers[key].trim()}\n`).join('')
    const canonicalRequest = [
      input.method,
      input.target.pathname,
      input.target.search.replace(/^\?/, ''),
      canonicalHeaders,
      signedHeaders.join(';'),
      input.payloadHash
    ].join('\n')
    const scope = `${input.dateStamp}/${input.region}/s3/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      input.amzDate,
      scope,
      sha256Hex(canonicalRequest)
    ].join('\n')
    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${input.secretKey}`, input.dateStamp), input.region), 's3'),
      'aws4_request'
    )
    return `AWS4-HMAC-SHA256 Credential=${input.accessKey}/${scope}, SignedHeaders=${signedHeaders.join(';')}, Signature=${hmac(signingKey, stringToSign).toString('hex')}`
  }
}
