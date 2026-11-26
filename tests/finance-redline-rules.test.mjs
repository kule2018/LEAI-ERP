import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDocumentRedLinePlan,
  buildRedLineEntries,
  buildSubjectMergePlan,
  canDisableSubject,
  canReleaseWriteoff,
  evaluateVoidVoucher
} from '../apps/server/dist/common/finance-redline-rules.js'

test('凭证作废：仅草稿可作废', () => {
  assert.equal(evaluateVoidVoucher({ status: 'DRAFT', periodClosed: false, hasReferences: false }).ok, true)
  assert.equal(evaluateVoidVoucher({ status: 'POSTED', periodClosed: false, hasReferences: false }).ok, false)
  assert.equal(evaluateVoidVoucher({ status: 'VOID', periodClosed: false, hasReferences: false }).ok, false)
  assert.equal(evaluateVoidVoucher({ status: 'CANCELLED', periodClosed: false, hasReferences: false }).ok, false)
})

test('凭证作废：期间已结账或被引用时拒绝', () => {
  assert.equal(evaluateVoidVoucher({ status: 'DRAFT', periodClosed: true, hasReferences: false }).ok, false)
  assert.equal(evaluateVoidVoucher({ status: 'DRAFT', periodClosed: false, hasReferences: true }).ok, false)
})

test('红字分录：借贷方向互换并加前缀', () => {
  const entries = buildRedLineEntries([
    { subjectId: 1, summary: '收款', debit: '100.00', credit: '0' },
    { subjectId: 2, summary: '结转', debit: '0', credit: '100.00' }
  ])
  assert.equal(entries[0].debit, '0.0000')
  assert.equal(entries[0].credit, '100.0000')
  assert.equal(entries[1].debit, '100.0000')
  assert.equal(entries[1].credit, '0.0000')
  assert.match(entries[0].summary, /^红冲：/)
})

test('单据红冲：期间已结账禁止红冲', () => {
  const plan = buildDocumentRedLinePlan({
    type: 'RECEIVABLE', amount: 100, settledAmount: 0, status: 'OPEN', periodClosed: true
  })
  assert.equal(plan.ok, false)
  assert.match(plan.reason, /结账/)
})

test('单据红冲：已计提坏账需先冲回坏账', () => {
  const plan = buildDocumentRedLinePlan({
    type: 'RECEIVABLE', amount: 100, settledAmount: 0, status: 'OPEN', periodClosed: false, provisionAmount: 10
  })
  assert.equal(plan.ok, false)
  assert.match(plan.reason, /坏账/)
})

test('单据红冲：收款单红冲冲回账户余额并释放核销', () => {
  const plan = buildDocumentRedLinePlan({
    type: 'RECEIPT', amount: 500, settledAmount: 500, status: 'POSTED', periodClosed: false
  })
  assert.equal(plan.ok, true)
  assert.equal(plan.accountBalanceDelta, -500)
  assert.equal(plan.releaseWriteoffAmount, 500)
  const payment = buildDocumentRedLinePlan({
    type: 'PAYMENT', amount: 200, settledAmount: 200, status: 'POSTED', periodClosed: false
  })
  assert.equal(payment.accountBalanceDelta, 200)
})

test('单据红冲：已红冲单据不可重复红冲', () => {
  const plan = buildDocumentRedLinePlan({
    type: 'PAYABLE', amount: 100, settledAmount: 0, status: 'REVERSED', periodClosed: false
  })
  assert.equal(plan.ok, false)
})

test('科目停用：有余额时拒绝停用', () => {
  assert.equal(canDisableSubject({ status: 'ENABLED', balance: 100, usedInVoucher: true }).ok, false)
  assert.equal(canDisableSubject({ status: 'ENABLED', balance: 0, usedInVoucher: true }).ok, true)
  assert.equal(canDisableSubject({ status: 'DISABLED', balance: 0, usedInVoucher: false }).ok, false)
})

test('科目合并：分类必须一致且合并余额', () => {
  const bad = buildSubjectMergePlan(
    { sourceBalance: 100, targetBalance: 50, sourceCategory: 'ASSET', targetCategory: 'LIABILITY', sourceUsed: true },
    3
  )
  assert.equal(bad.ok, false)
  const good = buildSubjectMergePlan(
    { sourceBalance: 100, targetBalance: 50, sourceCategory: 'ASSET', targetCategory: 'ASSET', sourceUsed: true },
    3
  )
  assert.equal(good.ok, true)
  assert.equal(good.mergedBalance, '150.0000')
  assert.equal(good.migratedEntryCount, 3)
})

test('核销释放：核销记录与单据已核销金额不一致时拒绝', () => {
  assert.equal(canReleaseWriteoff({ settledAmount: 100, writeoffAmount: 100 }).ok, true)
  assert.equal(canReleaseWriteoff({ settledAmount: 100, writeoffAmount: 80 }).ok, false)
  assert.equal(canReleaseWriteoff({ settledAmount: 0, writeoffAmount: 0 }).ok, true)
})
