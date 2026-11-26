import { createHash } from 'node:crypto'
import type { Server as HttpServer } from 'node:http'
import type { Duplex } from 'node:stream'
import { Injectable } from '@nestjs/common'
import type { JwtService } from '@nestjs/jwt'
import { env } from '../../config/env'

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

interface ClientConnection {
  tenantId: number
  userId: number
  socket: Duplex
  channels: Set<string>
}

export interface RealtimeEnvelope<T = unknown> {
  event: string
  payload: T
  at: string
}

/** 进程内实时连接注册表：按租户/用户维度推送业务事件 */
@Injectable()
export class RealtimeService {
  private readonly connections = new Set<ClientConnection>()

  register(connection: ClientConnection): void {
    this.connections.add(connection)
  }

  unregister(connection: ClientConnection): void {
    this.connections.delete(connection)
  }

  subscribe(connection: ClientConnection, channel: string): void {
    connection.channels.add(channel)
  }

  sendToUser<T>(tenantId: number, userId: number, event: string, payload: T): number {
    return this.deliver(tenantId, (item) => item.userId === userId, event, payload)
  }

  broadcast<T>(tenantId: number, event: string, payload: T, channel?: string): number {
    return this.deliver(tenantId, (item) => !channel || item.channels.has(channel), event, payload)
  }

  onlineUsers(tenantId: number): number[] {
    return [...new Set([...this.connections].filter((item) => item.tenantId === tenantId).map((item) => item.userId))]
  }

  get connectionCount(): number {
    return this.connections.size
  }

  private deliver<T>(
    tenantId: number,
    predicate: (item: ClientConnection) => boolean,
    event: string,
    payload: T
  ): number {
    const envelope: RealtimeEnvelope<T> = { event, payload, at: new Date().toISOString() }
    const data = JSON.stringify(envelope)
    let sent = 0
    for (const connection of this.connections) {
      if (connection.tenantId !== tenantId || !predicate(connection)) continue
      try {
        writeFrame(connection.socket, data)
        sent += 1
      } catch {
        this.connections.delete(connection)
      }
    }
    return sent
  }
}

/** 将 WebSocket 握手挂到 Nest 的 HTTP Server；仅实现文本帧与 ping/pong/close */
export function attachWebSocketGateway(
  server: HttpServer,
  service: RealtimeService,
  jwtService: JwtService
): void {
  if (!env.websocket.enabled) return

  server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost')
    if (requestUrl.pathname !== env.websocket.path) return

    const token = requestUrl.searchParams.get('token')
    if (!token) {
      rejectUpgrade(socket, 401, 'Missing token')
      return
    }
    try {
      const claims = jwtService.verify<Record<string, unknown>>(token, { secret: env.jwt.secret })
      const tenantId = Number(claims.tenantId)
      const userId = Number(claims.sub ?? claims.userId)
      if (!Number.isFinite(tenantId) || !Number.isFinite(userId)) {
        rejectUpgrade(socket, 401, 'Invalid claims')
        return
      }
      acceptUpgrade(request.headers['sec-websocket-key'], socket, head, service, tenantId, userId)
    } catch {
      rejectUpgrade(socket, 401, 'Invalid token')
    }
  })
}

function rejectUpgrade(socket: Duplex, status: number, reason: string): void {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`)
  socket.destroy()
}

function acceptUpgrade(
  key: string | string[] | undefined,
  socket: Duplex,
  head: Buffer,
  service: RealtimeService,
  tenantId: number,
  userId: number
): void {
  if (typeof key !== 'string') {
    rejectUpgrade(socket, 400, 'Missing websocket key')
    return
  }
  if (service.connectionCount >= env.websocket.maxConnections) {
    rejectUpgrade(socket, 503, 'Too many connections')
    return
  }
  const accept = createHash('sha1').update(`${key}${WS_GUID}`).digest('base64')
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  )
  const connection: ClientConnection = { tenantId, userId, socket, channels: new Set() }
  service.register(connection)
  let pending: Buffer = head.length > 0 ? Buffer.from(head) : Buffer.alloc(0)

  socket.on('data', (chunk: Buffer) => {
    pending = Buffer.concat([pending, chunk])
    pending = consumeFrames(pending, connection, service)
  })
  socket.on('close', () => service.unregister(connection))
  socket.on('error', () => service.unregister(connection))
}

function consumeFrames(buffer: Buffer, connection: ClientConnection, service: RealtimeService): Buffer {
  let offset = 0
  while (buffer.length - offset >= 2) {
    const first = buffer[offset]
    const second = buffer[offset + 1]
    const masked = (second & 0x80) !== 0
    let length = second & 0x7f
    let headerSize = 2
    if (length === 126) {
      if (buffer.length - offset < 4) break
      length = buffer.readUInt16BE(offset + 2)
      headerSize = 4
    } else if (length === 127) {
      if (buffer.length - offset < 10) break
      const long = buffer.readBigUInt64BE(offset + 2)
      if (long > BigInt(2 ** 31)) {
        connection.socket.destroy()
        return Buffer.alloc(0)
      }
      length = Number(long)
      headerSize = 10
    }
    const maskSize = masked ? 4 : 0
    if (buffer.length - offset < headerSize + maskSize + length) break

    const payloadStart = offset + headerSize + maskSize
    const payload = Buffer.from(buffer.subarray(payloadStart, payloadStart + length))
    if (masked) {
      const mask = buffer.subarray(offset + headerSize, payloadStart)
      for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4]
    }
    offset = payloadStart + length

    const opcode = first & 0x0f
    if (opcode === 0x8) {
      writeFrame(connection.socket, '', 0x8)
      connection.socket.destroy()
      return Buffer.alloc(0)
    }
    if (opcode === 0x9) {
      writeFrame(connection.socket, payload.toString('utf8'), 0xa)
      continue
    }
    if (opcode !== 0x1) continue
    try {
      const message = JSON.parse(payload.toString('utf8')) as { type?: string; channel?: string }
      if (message.type === 'subscribe' && typeof message.channel === 'string') {
        service.subscribe(connection, message.channel.slice(0, 64))
        writeFrame(connection.socket, JSON.stringify({ event: 'subscribed', payload: { channel: message.channel } }))
      }
    } catch {
      writeFrame(connection.socket, JSON.stringify({ event: 'error', payload: { message: 'invalid json' } }))
    }
  }
  return Buffer.from(buffer.subarray(offset))
}

export function writeFrame(socket: Duplex, data: string, opcode = 0x1): void {
  const payload = Buffer.from(data, 'utf8')
  const length = payload.length
  let header: Buffer
  if (length < 126) {
    header = Buffer.alloc(2)
    header[1] = length
  } else if (length < 65536) {
    header = Buffer.alloc(4)
    header[1] = 126
    header.writeUInt16BE(length, 2)
  } else {
    header = Buffer.alloc(10)
    header[1] = 127
    header.writeBigUInt64BE(BigInt(length), 2)
  }
  header[0] = 0x80 | opcode
  socket.write(Buffer.concat([header, payload]))
}
