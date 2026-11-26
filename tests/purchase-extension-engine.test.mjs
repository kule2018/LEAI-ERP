import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allocateCost, arrivalPlanStatus, checkBankAccount, checkEstimateReversal,
  checkStatementReverse, diffOrderChange, frameAgreementState, freightReconcile,
  matchEvidenceChain, matchScan, mergeDemandPlan,
  outsourceLoss, purchasePerformance, qualificationAlerts, receiptDifference,
  recommendAward, resolvePurchasePrice, scoreQuotes, statementDifference,
  supplierBlacklistHit, supplierRadar, waybillTrackStatus
} from '../apps/server/dist/common/purchase-extension-engine.js'

test('银行账户校验拦截非法账号与户名不一致', () => {
  const ok = checkBankAccount({
    accountNo: '6222 0202 0000 1234',
    accountName: '上海某某材料有限公司',
    bankName: '中国银行上海分行',
    supplierName: '上海某某材料有限公司'
  })
  assert.equal(ok.ok, true)
  const bad = checkBankAccount({
    accountNo: '123',
    accountName: '张三',
    bankName: '',
    supplierName: '上海某某材料有限公司'
  })
  assert.equal(bad.ok, false)
  assert.equal(bad.reasons.length >= 3, true)
})

test('银行账号重复被拦截', () => {
  const result = checkBankAccount({
    accountNo: '6222020200001234',
    accountName: '上海某某材料有限公司',
    bankName: '中国银行',
    supplierName: '上海某某材料有限公司',
    existingAccounts: [{ id: 7, accountNo: '6222020200001234', accountName: '上海某某材料有限公司' }]
  })
  assert.equal(result.ok, false)
})

test('供应商评级雷达输出等级与最弱维度', () => {
  const radar = supplierRadar({ quality: 95, delivery: 90, price: 88, service: 92, compliance: 90 })
  assert.equal(radar.level, 'A')
  assert.equal(radar.weakest, '价格')
  assert.equal(radar.radar.length, 5)
})

test('资质到期预警区分过期与临期', () => {
  const result = qualificationAlerts([
    { id: 1, qualificationType: 'ISO9001', expireDate: '2020-01-01' },
    { id: 2, qualificationType: 'ISO14001', expireDate: '2026-01-20' }
  ], '2026-01-01', 30)
  assert.equal(result[0].level, 'EXPIRED')
  assert.equal(result[1].level, 'EXPIRING')
})

test('比价评分不单纯以最低价授标', () => {
  const scored = scoreQuotes([
    { id: 1, supplierId: 10, price: 100, leadDays: 3, score: 95 },
    { id: 2, supplierId: 11, price: 80, leadDays: 15, score: 70 }
  ], { price: 50, lead: 30, score: 20 })
  assert.equal(scored[0].rank, 1)
  const recommendation = recommendAward(scored)
  assert.equal(recommendation.recommendedQuoteId, 1)
  assert.equal(recommendation.needsManualReview, true)
})

test('采购需求合并按产品汇总数量', () => {
  const plan = mergeDemandPlan([
    { id: 1, productId: 5, qty: 10, sourceType: 'REPLENISH' },
    { id: 2, productId: 5, qty: 5, sourceType: 'MANUAL' },
    { id: 3, productId: 6, qty: 2, sourceType: 'MANUAL' }
  ])
  assert.equal(plan.length, 2)
  assert.equal(plan[0].qty, 15)
  assert.deepEqual(plan[0].sourceDemandIds, [1, 2])
})

test('订单变更差异仅保留变化字段', () => {
  const diff = diffOrderChange(
    { expectedDate: '2026-01-01', remark: null, totalAmount: '100' },
    { expectedDate: '2026-02-01', remark: null, totalAmount: '100' }
  )
  assert.equal(diff.length, 1)
  assert.equal(diff[0].field, 'expectedDate')
})

test('到货计划逾期判定与进度', () => {
  const done = arrivalPlanStatus({ planQty: 100, arrivedQty: 100, planDate: '2026-01-01', at: '2026-01-05' })
  assert.equal(done.status, 'DONE')
  const overdue = arrivalPlanStatus({ planQty: 100, arrivedQty: 50, planDate: '2026-01-01', at: '2026-01-11' })
  assert.equal(overdue.status, 'OVERDUE')
  assert.equal(overdue.overdueDays, 10)
  assert.equal(overdue.progress, 50)
})

test('扫码收货按条码匹配并返回未收数量', () => {
  const hit = matchScan('6901234567890', [
    { id: 1, productId: 3, barcode: '6901234567890', qty: 10, receivedQty: 4 }
  ])
  assert.equal(hit.matched, true)
  assert.equal(hit.lineId, 1)
  assert.equal(hit.remainQty, 6)
  assert.equal(matchScan('unknown', []).matched, false)
})

test('差异收货识别超收与质检不合格', () => {
  const over = receiptDifference({ orderQty: 100, receiptQty: 120, toleranceRate: 0.05 })
  assert.equal(over.type, 'OVER')
  assert.equal(over.needApproval, true)
  const quality = receiptDifference({ orderQty: 100, receiptQty: 100, qualityFailQty: 3 })
  assert.equal(quality.type, 'QUALITY')
  assert.equal(quality.needApproval, true)
})

test('暂估冲销要求金额差异在容差内', () => {
  assert.equal(checkEstimateReversal({ estimateAmount: 1000, invoiceAmount: 1005 }).allowed, true)
  assert.equal(checkEstimateReversal({ estimateAmount: 1000, invoiceAmount: 1200 }).allowed, false)
})

test('成本分摊尾差归入末项', () => {
  const result = allocateCost(100, [
    { key: 'a', qty: 1 },
    { key: 'b', qty: 2 }
  ], 'QTY')
  assert.equal(result[0].amount, 33.3333)
  assert.equal(result[1].amount, 66.6667)
  const total = result.reduce((sum, item) => sum + item.amount, 0)
  assert.equal(Math.round(total * 10000) / 10000, 100)
})

test('对账三方差异与红冲校验', () => {
  const diff = statementDifference({ orderAmount: 1000, receivedAmount: 1200, invoicedAmount: 1000 })
  assert.equal(diff.matched, false)
  assert.equal(diff.differences[0].field, '收货金额')
  assert.equal(checkStatementReverse({ amount: 200, statementAmount: 1000, settledAmount: 900, reversedAmount: 0 }).allowed, false)
  assert.equal(checkStatementReverse({ amount: 100, statementAmount: 1000, settledAmount: 0, reversedAmount: 0 }).allowed, true)
})

test('委外损耗超标准需审批', () => {
  const result = outsourceLoss({ issuedQty: 100, receivedQty: 95, standardLossRate: 0.03 })
  assert.equal(result.lossQty, 5)
  assert.equal(result.exceed, true)
  assert.equal(result.needApproval, true)
})

test('物流轨迹取最新节点并识别异常', () => {
  const result = waybillTrackStatus([
    { nodeName: '揽收', nodeTime: '2026-01-01 08:00:00' },
    { nodeName: '签收异常', nodeTime: '2026-01-03 08:00:00', status: 'DAMAGED' }
  ])
  assert.equal(result.latest.nodeName, '签收异常')
  assert.equal(result.abnormal, true)
})

test('运费对账超出容差不通过', () => {
  assert.equal(freightReconcile({ declaredAmount: 100, settledAmount: 101 }).matched, true)
  assert.equal(freightReconcile({ declaredAmount: 100, settledAmount: 300 }).matched, false)
})

test('采购取价按有效期与优先级命中', () => {
  const result = resolvePurchasePrice([
    { id: 1, supplierId: 5, productId: 9, price: 12, startDate: '2025-01-01', endDate: '2025-12-31', priority: 1, status: 'ENABLED' },
    { id: 2, supplierId: 5, productId: 9, price: 11, startDate: '2026-01-01', endDate: '2026-12-31', priority: 1, status: 'ENABLED' },
    { id: 3, supplierId: 5, productId: 9, price: 9, startDate: '2026-01-01', endDate: '2026-12-31', priority: 5, status: 'ENABLED' }
  ], { productId: 9, supplierId: 5, at: '2026-03-01' })
  assert.equal(result.priceId, 3)
  assert.equal(result.price, 9)
})

test('采购绩效输出及时率与供应商排行', () => {
  const result = purchasePerformance({
    orders: [
      { supplierId: 1, totalAmount: 100, expectedDate: '2026-01-10', receivedDate: '2026-01-08' },
      { supplierId: 2, totalAmount: 200, expectedDate: '2026-01-10', receivedDate: '2026-01-20' }
    ],
    receipts: [
      { supplierId: 1, qty: 10, passQty: 10, amount: 100 },
      { supplierId: 2, qty: 10, passQty: 6, amount: 200 }
    ]
  })
  assert.equal(result.onTimeRate, 50)
  assert.equal(result.passRate, 80)
  assert.equal(result.supplierRanking[0].supplierId, 1)
  assert.equal(result.totalAmount, 300)
})

test('三方匹配证据链逐行固化来源单据与差异', () => {
  const chain = matchEvidenceChain([
    {
      productId: 1, orderNo: 'PO1', receiptNo: 'GR1', invoiceNo: 'INV1',
      orderQty: 10, receiptQty: 10, invoiceQty: 10, orderPrice: 5, invoicePrice: 5,
      matched: true, status: 'MATCHED', issues: []
    },
    {
      productId: 2, orderNo: 'PO1', receiptNo: 'GR1', invoiceNo: 'INV1',
      orderQty: 10, receiptQty: 8, invoiceQty: 10, orderPrice: 3, invoicePrice: 3,
      matched: false, status: 'QUANTITY_DIFF', issues: ['收货数量与订单不一致']
    }
  ])
  assert.equal(chain.matched, false)
  assert.equal(chain.status, 'QUANTITY_DIFF')
  assert.equal(chain.issueCount, 1)
  assert.equal(chain.evidence.length, 2)
  assert.equal(chain.evidence[0].orderNo, 'PO1')
  assert.equal(chain.evidence[0].receiptNo, 'GR1')
})

test('三方匹配证据链全部一致时标记 MATCHED', () => {
  const chain = matchEvidenceChain([
    {
      productId: 1, orderNo: 'PO1', receiptNo: 'GR1', invoiceNo: null,
      orderQty: 1, receiptQty: 1, invoiceQty: 1, orderPrice: 1, invoicePrice: 1,
      matched: true, status: 'MATCHED', issues: []
    }
  ])
  assert.equal(chain.matched, true)
  assert.equal(chain.status, 'MATCHED')
  assert.equal(chain.issueCount, 0)
})

test('框架协议版本校验生效期与数量额度', () => {
  const ok = frameAgreementState({ version: 1, startDate: '2026-01-01', endDate: '2026-12-31', totalQty: 100, usedQty: 30, at: '2026-03-01' })
  assert.equal(ok.valid, true)
  assert.equal(ok.nextVersion, 2)
  assert.equal(ok.remainingQty, 70)
  const notStarted = frameAgreementState({ version: 1, startDate: '2026-06-01', endDate: null, totalQty: null, usedQty: 0, at: '2026-03-01' })
  assert.equal(notStarted.valid, false)
  assert.equal(notStarted.reason, '协议尚未生效')
  const expired = frameAgreementState({ version: 1, startDate: null, endDate: '2026-02-01', totalQty: null, usedQty: 0, at: '2026-03-01' })
  assert.equal(expired.valid, false)
  assert.equal(expired.reason, '协议已到期')
  const exhausted = frameAgreementState({ version: 2, startDate: null, endDate: null, totalQty: 100, usedQty: 100, at: '2026-03-01' })
  assert.equal(exhausted.valid, false)
  assert.equal(exhausted.remainingQty, 0)
})

test('供应商黑名单命中生效区间内的记录', () => {
  const rules = [
    { supplierId: 1, level: 'HIGH', startDate: '2026-01-01', endDate: '2026-12-31' },
    { supplierId: 2, level: 'LOW', startDate: '2026-05-01', endDate: null }
  ]
  const hit = supplierBlacklistHit(rules, 1, '2026-03-01')
  assert.equal(hit.hit, true)
  assert.equal(hit.level, 'HIGH')
  assert.ok(hit.reason.includes('黑名单'))
  assert.equal(supplierBlacklistHit(rules, 2, '2026-03-01').hit, false)
  assert.equal(supplierBlacklistHit(rules, 3, '2026-03-01').hit, false)
  assert.equal(supplierBlacklistHit(rules, 1, '2027-03-01').hit, false)
})
