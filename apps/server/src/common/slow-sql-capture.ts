import { aggregateSlowSql, buildSlowSqlEntry, isSlowSql, type SlowSqlEntry } from './platform-guard-engine'

/**
 * 慢 SQL 采集器：进程内环形缓冲，超阈值 SQL 落内存并可批量落库分析。
 */
export class SlowSqlCollector {
  private readonly entries: SlowSqlEntry[] = []
  private thresholdMs: number
  private keepSize: number

  constructor(thresholdMs = 500, keepSize = 200) {
    this.thresholdMs = thresholdMs
    this.keepSize = keepSize
  }

  configure(thresholdMs: number, keepSize: number): void {
    if (thresholdMs > 0) this.thresholdMs = thresholdMs
    if (keepSize > 0) this.keepSize = keepSize
  }

  /** 记录一次 SQL 执行；未超过阈值直接忽略 */
  record(sql: string, durationMs: number, rowCount = 0): SlowSqlEntry | null {
    if (!isSlowSql(durationMs, this.thresholdMs)) return null
    const entry = buildSlowSqlEntry(sql, durationMs, rowCount, this.thresholdMs)
    this.entries.push(entry)
    while (this.entries.length > this.keepSize) this.entries.shift()
    return entry
  }

  /** 最近采集明细（倒序） */
  list(limit = 50): SlowSqlEntry[] {
    return [...this.entries].reverse().slice(0, limit)
  }

  /** 按 SQL 聚合统计 */
  aggregate(): ReturnType<typeof aggregateSlowSql> {
    return aggregateSlowSql(this.entries)
  }

  /** 取出并清空缓冲（用于落库） */
  drain(): SlowSqlEntry[] {
    const result = [...this.entries]
    this.entries.length = 0
    return result
  }

  get size(): number {
    return this.entries.length
  }
}

/** 全局采集器实例 */
export const slowSqlCollector = new SlowSqlCollector()
