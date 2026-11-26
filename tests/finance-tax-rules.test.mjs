import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTaxDeclaration, computeTaxAmount, validateCategory, validateTaxCode
} from '../apps/server/dist/common/finance-tax-rules.js'
import { buildAuxTrialBalance } from '../apps/server/dist/common/finance-extension-engine.js'

test('税码校验：编码/税率/税种', () => {
  const base = { code: 'VAT13', name: '增值税13%', rate: 0.13, taxType: 'VAT', direction: 'OUTPUT', status: 'ENABLED' }
  assert.equal(validateTaxCode(base).ok, true)
  assert.equal(validateTaxCode({ ...base, code: '' }).ok, false)
  assert.equal(validateTaxCode({ ...base, rate: 1.5 }).ok, false)
  assert.equal(validateTaxCode({ ...base, taxType: 'UNKNOWN' }).ok, false)
})

test('价税分离：不含税与含税口径', () => {
  const exclusive = computeTaxAmount(1000, 0.13)
  assert.equal(exclusive.taxAmount, 130)
  assert.equal(exclusive.grossAmount, 1130)
  const inclusive = computeTaxAmount(1130, 0.13, true)
  assert.equal(inclusive.netAmount, 1000)
  assert.equal(inclusive.taxAmount, 130)
})

test('申报汇总按税码汇总销项进项', () => {
  const result = buildTaxDeclaration([
    { taxCode: 'VAT13', taxName: '增值税13%', taxType: 'VAT', direction: 'OUTPUT', taxableAmount: 1000, taxAmount: 130 },
    { taxCode: 'VAT13', taxName: '增值税13%', taxType: 'VAT', direction: 'INPUT', taxableAmount: 500, taxAmount: 65 },
    { taxCode: 'CIT25', taxName: '企业所得税25%', taxType: 'CIT', direction: 'OUTPUT', taxableAmount: 200, taxAmount: 50 }
  ])
  assert.equal(result.rows.length, 2)
  assert.equal(result.totalOutputTax, 180)
  assert.equal(result.totalInputTax, 65)
  assert.equal(result.taxPayable, 115)
  assert.equal(result.rows[0].netTax, 65)
})

test('进项税额抵扣上限', () => {
  const result = buildTaxDeclaration([
    { taxCode: 'VAT13', taxName: '增值税13%', taxType: 'VAT', direction: 'INPUT', taxableAmount: 1000, taxAmount: 130, deductibleAmount: 80 }
  ])
  assert.equal(result.totalInputTax, 80)
})

test('费用/收入类别校验', () => {
  const base = { code: 'TRAVEL', name: '差旅费', categoryType: 'EXPENSE' }
  assert.equal(validateCategory(base).ok, true)
  assert.equal(validateCategory({ ...base, parentCode: 'TRAVEL' }).ok, false)
  assert.equal(validateCategory({ ...base, name: '' }).ok, false)
})

test('试算表按辅助核算维度展开', () => {
  const subjectMap = new Map([[1, { subjectCode: '6601', subjectName: '销售费用' }]])
  const rows = buildAuxTrialBalance([
    { subjectId: 1, auxType: 'DEPT', auxId: '10', debit: 100, credit: 0 },
    { subjectId: 1, auxType: 'DEPT', auxId: '10', debit: 50, credit: 0 },
    { subjectId: 1, auxType: 'DEPT', auxId: '20', debit: 30, credit: 0 },
    { subjectId: 1, auxType: null, auxId: null, debit: 10, credit: 0 }
  ], subjectMap)
  assert.equal(rows.length, 3)
  assert.equal(rows[0].debit, 150)
  assert.equal(rows[0].auxId, '10')
  assert.equal(rows[2].balance, 10)
})
