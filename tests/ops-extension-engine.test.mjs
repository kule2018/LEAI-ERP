import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allocateAssemblyCost, applyStocktakeScans, buildBatchLocationMatrix, computeAvailableQty,
  evaluateTransferReceipt
} from '../apps/server/dist/common/inventory-ops-engine.js'
import {
  buildCycleKey, buildSerial, detectDuplicateSerials, evaluateBarcodeRule,
  evaluateLabelPrintRepeat, formatDateSegment
} from '../apps/server/dist/common/barcode-engine.js'
import {
  evaluateCertificateExpiry, evaluatePerformanceAppeal, evaluatePunchRequest, evaluateSalaryApproval,
  filterSensitiveWords, maskSalaryAmount, parseMeetingTasks
} from '../apps/server/dist/common/collaboration-ops-engine.js'

test('可用量=实物量-锁定量-冻结量，负值归零', () => {
  const result = computeAvailableQty({ qtyOnHand: '10', qtyOccupied: '3', qtyFrozen: '2' })
  assert.equal(result.available, 5)
  const negative = computeAvailableQty({ qtyOnHand: '1', qtyOccupied: '3', qtyFrozen: '0' })
  assert.equal(negative.available, 0)
})

test('批次库位矩阵按产品与仓库聚合并排序', () => {
  const rows = buildBatchLocationMatrix([
    { productId: 1, variantId: 0, warehouseId: 2, locationId: 1, batchNo: 'B2', qtyOnHand: '5', qtyOccupied: '1', qtyFrozen: '0' },
    { productId: 1, variantId: 0, warehouseId: 2, locationId: 2, batchNo: 'B1', qtyOnHand: '4', qtyOccupied: '0', qtyFrozen: '1' },
    { productId: 2, variantId: 0, warehouseId: 2, locationId: 1, batchNo: 'B1', qtyOnHand: '3', qtyOccupied: '0', qtyFrozen: '0' }
  ])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].productId, 1)
  assert.equal(rows[0].totalOnHand, 9)
  assert.equal(rows[0].totalAvailable, 7)
  assert.equal(rows[0].cells[0].batchNo, 'B2')
  assert.equal(rows[0].cells[1].batchNo, 'B1')
})

test('扫码实盘累加实盘数量并计算差异', () => {
  const result = applyStocktakeScans(
    [{ lineId: 1, productId: 10, variantId: 0, batchNo: 'B1', bookQty: 10, actualQty: 0, recountQty: null, diffQty: 0 }],
    [{ productId: 10, batchNo: 'B1', qty: '4' }, { productId: 10, batchNo: 'B1', qty: '3' }],
    false
  )
  assert.equal(result.scannedCount, 2)
  assert.equal(result.scannedQty, 7)
  assert.equal(result.lines[0].actualQty, 7)
  assert.equal(result.lines[0].diffQty, -3)
})

test('盲盘模式不返回账面数量', () => {
  const result = applyStocktakeScans(
    [{ lineId: 1, productId: 10, variantId: 0, batchNo: 'B1', bookQty: 10, actualQty: 0, recountQty: null, diffQty: 0 }],
    [{ lineId: 1, qty: '10' }],
    true
  )
  assert.equal(result.blindMode, true)
  assert.equal(result.lines[0].bookQty, 0)
  assert.equal(result.lines[0].diffQty, 0)
})

test('调拨签收短收记录差异、超收判为异常', () => {
  const judgement = evaluateTransferReceipt([
    { lineId: 1, qty: '10', receivedQty: '8' },
    { lineId: 2, qty: '5', receivedQty: '6' }
  ])
  assert.equal(judgement.hasShortage, true)
  assert.equal(judgement.hasOverage, true)
  assert.equal(judgement.totalShortage, 2)
  assert.equal(judgement.totalOverage, 1)
  assert.equal(judgement.judgements[0].reason.includes('调拨差异'), true)
})

test('拆装成本按产出数量分摊到成品单位成本', () => {
  const result = allocateAssemblyCost(
    [{ productId: 1, batchNo: 'B1', variantId: 0, unitCost: 10, qtyPerOutput: 2 }],
    5
  )
  assert.equal(result.outputQty, 5)
  assert.equal(result.totalCost, 100)
  assert.equal(result.unitCost, 20)
})

test('条码序列号按前缀+日期+流水拼装', () => {
  const date = new Date('2026-03-05T10:20:30')
  assert.equal(formatDateSegment('yyyyMMdd', date), '20260305')
  const serial = buildSerial({ prefix: 'SKU', dateFormat: 'yyyyMMdd', seqLength: 4 }, date, 7)
  assert.equal(serial, 'SKU202603050007')
  assert.equal(buildCycleKey({ resetCycle: 'MONTHLY' }, date), '202603')
})

test('编码规则非法前缀与日期格式被拒绝', () => {
  assert.equal(evaluateBarcodeRule({ prefix: 'A B' }).ok, false)
  assert.equal(evaluateBarcodeRule({ dateFormat: 'YYYY' }).ok, false)
  assert.equal(evaluateBarcodeRule({ prefix: 'AB', dateFormat: 'yyyyMMdd', seqLength: 6 }).ok, true)
})

test('序列号批量查重命中已有与批内重复', () => {
  const duplicates = detectDuplicateSerials(['A1', 'A2', 'A1'], new Set(['A2']))
  assert.deepEqual(duplicates.sort(), ['A1', 'A2'])
})

test('标签重复打印提示', () => {
  assert.equal(evaluateLabelPrintRepeat(0).warn, false)
  const repeated = evaluateLabelPrintRepeat(2)
  assert.equal(repeated.warn, true)
  assert.ok(repeated.message.includes('重复打印'))
})

test('敏感词过滤掩码替换并拦截高危词', () => {
  const rules = [{ word: '保密', level: 'MEDIUM' }, { word: '违规', level: 'HIGH' }]
  const filtered = filterSensitiveWords('这是保密内容含违规字', rules)
  assert.equal(filtered.text.includes('保密'), false)
  assert.deepEqual(filtered.hits, ['保密', '违规'])
  assert.equal(filtered.blocked, true)
  assert.equal(filterSensitiveWords('正常内容', rules).blocked, false)
})

test('薪酬金额脱敏返回档位区间', () => {
  assert.equal(maskSalaryAmount('25000', true), '25000')
  assert.equal(maskSalaryAmount('25000', false), '***(高档)')
  assert.equal(maskSalaryAmount('12000', false), '***(中档)')
  assert.equal(maskSalaryAmount('5000', false), '***(低档)')
})

test('补卡同日重复申请被拒绝', () => {
  const existing = [{ employeeId: 1, punchDate: '2026-03-05' }]
  assert.equal(evaluatePunchRequest(existing, 1, '2026-03-05').ok, false)
  assert.equal(evaluatePunchRequest(existing, 1, '2026-03-06').ok, true)
})

test('薪酬发放审批状态流转校验', () => {
  assert.equal(evaluateSalaryApproval('DRAFT').ok, true)
  assert.equal(evaluateSalaryApproval('PAID').ok, false)
})

test('培训证书到期提醒计算剩余天数', () => {
  const at = new Date('2026-03-05T00:00:00.000Z')
  assert.equal(evaluateCertificateExpiry('2026-03-01', 30, at).expired, true)
  assert.equal(evaluateCertificateExpiry('2026-03-20', 30, at).expiring, true)
  assert.equal(evaluateCertificateExpiry('2026-06-20', 30, at).expiring, false)
  assert.equal(evaluateCertificateExpiry(null, 30, at).days, null)
})

test('绩效申诉仅在已申诉状态可处理', () => {
  assert.equal(evaluatePerformanceAppeal('APPEALED').ok, true)
  assert.equal(evaluatePerformanceAppeal('NONE').ok, false)
})

test('会议纪要解析任务行', () => {
  const tasks = parseMeetingTasks('结论如下\n- 完成对账@12@2026-04-01\n* 复核报表')
  assert.equal(tasks.length, 2)
  assert.equal(tasks[0].taskName, '完成对账')
  assert.equal(tasks[0].assigneeId, 12)
  assert.equal(tasks[0].dueDate, '2026-04-01')
  assert.equal(tasks[1].assigneeId, null)
})
