export const BIZ_TRANSITIONS: Record<string, Record<string, string[]>> = {
  sale_order: {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['APPROVED', 'DRAFT', 'CANCELLED'],
    APPROVED: ['PARTIAL', 'DONE', 'CANCELLED'],
    PARTIAL: ['DONE', 'CANCELLED'],
    DONE: [],
    CANCELLED: []
  },
  purchase_order: {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['APPROVED', 'DRAFT', 'CANCELLED'],
    APPROVED: ['PARTIAL', 'DONE', 'CANCELLED'],
    PARTIAL: ['DONE', 'CANCELLED'],
    DONE: [],
    CANCELLED: []
  },
  work_order: {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['APPROVED', 'DRAFT', 'CANCELLED'],
    APPROVED: ['PARTIAL', 'DONE', 'CANCELLED'],
    PARTIAL: ['DONE', 'CANCELLED'],
    DONE: [],
    CANCELLED: []
  },
  outsource_order: {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['APPROVED', 'DRAFT', 'CANCELLED'],
    APPROVED: ['PARTIAL', 'DONE', 'CANCELLED'],
    PARTIAL: ['DONE', 'CANCELLED'],
    DONE: [],
    CANCELLED: []
  }
}

export function canTransition(bizType: string, from: string, to: string): boolean {
  return BIZ_TRANSITIONS[bizType]?.[from]?.includes(to) ?? false
}

export function assertTransition(bizType: string, from: string, to: string, message?: string): void {
  if (!canTransition(bizType, from, to)) {
    throw new Error(message ?? `不允许从 ${from} 流转到 ${to}`)
  }
}
