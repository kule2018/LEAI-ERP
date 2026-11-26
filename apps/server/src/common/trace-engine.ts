/**
 * 批次/序列号追溯纯逻辑引擎：从库存流水中构建正向/反向追溯与召回清单。
 * 供库存服务复用，与持久层解耦便于单测。
 */

export interface TraceEntry {
  id: number
  batchNo: string
  serialNo?: string | null
  voucherType: string
  voucherId: number
  direction: 'IN' | 'OUT'
  qty: number
  productId: number
  occurredAt?: Date | string
}

/**
 * 反向追溯：给定批次的来源入库流水。
 */
export function traceBackward(entries: TraceEntry[], batchNo: string, serialNo?: string): TraceEntry[] {
  return entries.filter(
    (e) => e.batchNo === batchNo && (!serialNo || e.serialNo === serialNo) && e.direction === 'IN'
  )
}

/**
 * 正向追溯：给定批次被消耗的出库流水（去向）。
 */
export function traceForward(entries: TraceEntry[], batchNo: string, serialNo?: string): TraceEntry[] {
  return entries.filter(
    (e) => e.batchNo === batchNo && (!serialNo || e.serialNo === serialNo) && e.direction === 'OUT'
  )
}

/** 召回清单：某批次所有已发出的出库单据凭证（去重） */
export function recallList(entries: TraceEntry[], batchNo: string): Array<{ voucherType: string; voucherId: number }> {
  const seen = new Set<string>()
  const result: Array<{ voucherType: string; voucherId: number }> = []
  for (const entry of traceForward(entries, batchNo)) {
    const key = `${entry.voucherType}:${entry.voucherId}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push({ voucherType: entry.voucherType, voucherId: entry.voucherId })
    }
  }
  return result
}

/** 序列号追溯：按序列号精确过滤 */
export function traceSerial(entries: TraceEntry[], serialNo: string): TraceEntry[] {
  return entries.filter((e) => e.serialNo === serialNo)
}
