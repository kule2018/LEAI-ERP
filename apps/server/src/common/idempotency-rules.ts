/**
 * 幂等规则（纯函数）：解析幂等键缓存记录，决定回放、冲突或处理中。
 * 供全局幂等拦截器与单元测试共用，保证离线重放语义一致。
 */
export interface IdempotentRecord {
  status: 'PENDING' | 'DONE'
  payload?: unknown
}

export type IdempotentAction =
  | { action: 'replay'; payload: unknown }
  | { action: 'conflict'; message: string }
  | { action: 'processing'; message: string }

/**
 * 解析幂等缓存记录：
 * - DONE 且带结果：回放首次执行结果（离线重放不会重复建单）
 * - DONE 无结果：冲突，提示人工核对
 * - PENDING：处理中，提示稍后确认
 */
export function resolveIdempotentRecord(raw: string | null): IdempotentAction {
  if (!raw) {
    return { action: 'conflict', message: '检测到重复提交，请勿短时间内重复操作' }
  }
  let record: IdempotentRecord
  try {
    record = JSON.parse(raw) as IdempotentRecord
  } catch {
    return { action: 'conflict', message: '检测到重复提交，请勿短时间内重复操作' }
  }
  if (record.status === 'DONE') {
    if (record.payload === undefined) {
      return { action: 'conflict', message: '该操作此前已提交，请到对应单据列表核对，避免重复提交' }
    }
    return { action: 'replay', payload: record.payload }
  }
  return { action: 'processing', message: '请求正在处理中，请稍后确认结果，避免重复提交' }
}
