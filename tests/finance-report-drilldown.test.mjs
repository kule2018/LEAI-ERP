import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDrilldownQuery, buildFinanceCsv, escapeCsvCell,
  REPORT_DRILLDOWN_CONFIG, summarizeDrilldownRows
} from '../apps/server/dist/common/finance-report-drilldown-rules.js'

const user = { tenantId: 7, userId: 42, username: 'accountant' }

test('报表指标下钻配置覆盖三大报表', () => {
  assert.equal(REPORT_DRILLDOWN_CONFIG.income.categories[0], 'INCOME')
  assert.equal(REPORT_DRILLDOWN_CONFIG.assets.side, 'DEBIT')
  assert.equal(REPORT_DRILLDOWN_CONFIG.liabilities.side, 'CREDIT')
  assert.throws(() => buildDrilldownQuery('UNKNOWN', '2026-03', []))
})

test('下钻查询参数携带科目集合与方向', () => {
  const result = buildDrilldownQuery('income', '2026-03', [1, 2])
  assert.equal(result.label, '收入')
  assert.deepEqual(result.subjectIds, [1, 2])
  assert.equal(result.side, 'CREDIT')
})

test('下钻汇总按借贷方向取数并过滤零额', () => {
  const rows = [
    { subjectId: 1, subjectCode: '6001', subjectName: '主营业务收入', debit: 5, credit: 100 },
    { subjectId: 2, subjectCode: '6051', subjectName: '其他业务收入', debit: 0, credit: 20 },
    { subjectId: 3, subjectCode: '6601', subjectName: '销售费用', debit: 30, credit: 0 }
  ]
  const credit = summarizeDrilldownRows(rows, 'CREDIT')
  assert.equal(credit.rows.length, 2)
  assert.equal(credit.rows[0].amount, 95)
  assert.equal(credit.total, 115)
  const debit = summarizeDrilldownRows(rows, 'DEBIT')
  assert.equal(debit.rows.length, 1)
  assert.equal(debit.total, 30)
})

test('CSV 转义逗号、引号与换行', () => {
  assert.equal(escapeCsvCell('普通'), '普通')
  assert.equal(escapeCsvCell('a,b'), '"a,b"')
  assert.equal(escapeCsvCell('a"b'), '"a""b"')
  assert.equal(escapeCsvCell('a\nb'), '"a\nb"')
  assert.equal(escapeCsvCell(null), '')
})

test('导出 CSV 附带水印且脱敏手机号', () => {
  const csv = buildFinanceCsv(
    ['科目', '摘要', '联系人'],
    [['6001', '货款', '13800138000']],
    user
  )
  assert.match(csv, /6001/)
  assert.match(csv, /138\*\*\*\*8000/)
  assert.match(csv, /水印编码/)
  assert.match(csv, /tenant-7-user-42/)
  assert.match(csv, /accountant/)
})
