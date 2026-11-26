import { Injectable, OnModuleInit } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { slowSqlCollector } from '../../common/slow-sql-capture'
import { env } from '../../config/env'

/**
 * 慢 SQL 采集：包装 DataSource.query 与 QueryRunner.query，
 * 超过阈值的语句进入内存环形缓冲，供指标接口查询与批量落库。
 */
@Injectable()
export class SlowSqlInterceptor implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    slowSqlCollector.configure(env.slowSql.thresholdMs, env.slowSql.keepSize)

    const original = this.dataSource.query.bind(this.dataSource)
    const patched = async (query: string, parameters?: unknown[], queryRunner?: unknown): Promise<unknown> => {
      const start = Date.now()
      try {
        return await original(query, parameters as never[], queryRunner as never)
      } finally {
        slowSqlCollector.record(query, Date.now() - start)
      }
    }
    try {
      ;(this.dataSource as unknown as { query: unknown }).query = patched
    } catch {
      // DataSource 不可写时退化为仅 QueryRunner 采集
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { QueryRunner } = require('typeorm') as { QueryRunner: { prototype: Record<string, unknown> } }
      const proto = QueryRunner.prototype as Record<string, unknown>
      const originalRunner = proto.query as (...args: unknown[]) => Promise<unknown>
      if (typeof originalRunner === 'function') {
        proto.query = async function patchedQuery(this: unknown, ...args: unknown[]): Promise<unknown> {
          const sql = typeof args[0] === 'string' ? args[0] : ''
          const start = Date.now()
          try {
            return await originalRunner.apply(this, args)
          } finally {
            if (sql) slowSqlCollector.record(sql, Date.now() - start)
          }
        }
      }
    } catch {
      // 采集失败不影响主流程
    }
  }
}
