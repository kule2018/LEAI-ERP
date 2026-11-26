/**
 * 条件审批表达式求值纯逻辑。
 * 支持简单比较表达式：field op value（op: == != > >= < <= contains in），
 * 多条件用 && / || 组合，支持括号分组的最小实现。
 * 仅使用白名单字段与安全的比较，绝不 eval 任意代码。
 */

export type ConditionContext = Record<string, unknown>

export interface ConditionResult {
  matched: boolean
  error?: string
}

const OPERATORS = ['>=', '<=', '!=', '==', '>', '<', 'contains', 'in'] as const

/** 解析单个比较表达式 */
function evaluateAtom(expr: string, ctx: ConditionContext): ConditionResult {
  const trimmed = expr.trim().replace(/^\(|\)$/g, '').trim()
  for (const op of OPERATORS) {
    const index = trimmed.indexOf(op)
    if (index <= 0) continue
    const left = trimmed.slice(0, index).trim()
    const rightRaw = trimmed.slice(index + op.length).trim()
    if (!left || !rightRaw) continue
    const leftValue = ctx[left]
    const rightValue = parseValue(rightRaw)
    if (leftValue == null) return { matched: false, error: `字段 ${left} 不存在` }
    switch (op) {
      case '==': return { matched: String(leftValue) === String(rightValue) }
      case '!=': return { matched: String(leftValue) !== String(rightValue) }
      case '>': return { matched: Number(leftValue) > Number(rightValue) }
      case '>=': return { matched: Number(leftValue) >= Number(rightValue) }
      case '<': return { matched: Number(leftValue) < Number(rightValue) }
      case '<=': return { matched: Number(leftValue) <= Number(rightValue) }
      case 'contains': return { matched: String(leftValue).includes(String(rightValue)) }
      case 'in': {
        const list = rightRaw.replace(/^\[|\]$/g, '').split(',').map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
        return { matched: list.includes(String(leftValue)) }
      }
    }
  }
  return { matched: false, error: `无法解析条件：${trimmed}` }
}

function parseValue(raw: string): string | number | boolean {
  const value = raw.trim().replace(/^['"]|['"]$/g, '')
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  if (value === 'true') return true
  if (value === 'false') return false
  return value
}

/** 求值条件表达式：支持 || / &&，|| 优先分组 */
export function evaluateCondition(expression: string | null | undefined, ctx: ConditionContext): ConditionResult {
  if (!expression?.trim()) return { matched: true }
  const orGroups = expression.split('||')
  let firstError: string | undefined
  for (const group of orGroups) {
    const andAtoms = group.split('&&')
    const results = andAtoms.map((atom) => evaluateAtom(atom, ctx))
    const failed = results.find((r) => !r.matched)
    if (!failed) return { matched: true }
    firstError = firstError ?? failed.error
  }
  return { matched: false, error: firstError }
}

/**
 * 按条件筛选节点：返回所有条件满足的节点（用于条件分支），
 * 无条件节点始终返回（兜底节点）。
 */
export function selectConditionalNodes<T extends { conditionExpr?: string | null }>(
  nodes: T[],
  ctx: ConditionContext
): T[] {
  return nodes.filter((node) => evaluateCondition(node.conditionExpr, ctx).matched)
}
