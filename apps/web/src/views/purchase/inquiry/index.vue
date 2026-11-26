<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { addQuote, awardQuote, createRfq, fetchRfqDetail, fetchRfqs, type Rfq } from '@/api/purchase'
import type { PageQuery } from '@/types/contract'

interface LineDraft { productId: number; qty: string; targetPrice: string }
interface DetailLine { id: number; productId: number; qty: string; targetPrice: string; quotes: Array<{ id: number; supplierId: number; price: string; score: string; awarded: string }> }

const rows = ref<Rfq[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const createVisible = ref(false)
const detailVisible = ref(false)
const detail = ref<{ rfq: Rfq; lines: DetailLine[] } | null>(null)
const form = reactive({ projectName: '', quoteDeadline: '' })
const lines = ref<LineDraft[]>([{ productId: 0, qty: '1', targetPrice: '0' }])
const quoteForm = reactive({ supplierId: 0, price: '0', leadDays: 0, score: '0' })
const activeLine = ref<DetailLine | null>(null)
const quoteVisible = ref(false)
let seq = 0

function lineValue(row: unknown, key: keyof LineDraft): string | number {
  const line = row as LineDraft
  return line[key]
}
function setLineValue(row: unknown, key: keyof LineDraft, value: string): void {
  const line = row as LineDraft
  if (key === 'productId') line.productId = Number(value) || 0
  else line[key] = value
}

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchRfqs(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    if (current === seq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (current === seq) loading.value = false
  }
}

function openCreate(): void {
  form.projectName = ''
  form.quoteDeadline = ''
  lines.value = [{ productId: 0, qty: '1', targetPrice: '0' }]
  createVisible.value = true
}

async function saveRfq(): Promise<void> {
  try {
    await createRfq({
      projectName: form.projectName,
      quoteDeadline: form.quoteDeadline || undefined,
      lines: lines.value
    })
    createVisible.value = false
    ElMessage.success('询价单已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function openDetail(row: unknown): Promise<void> {
  const rfq = row as Rfq
  try {
    detail.value = await fetchRfqDetail(rfq.id)
    detailVisible.value = true
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '详情加载失败')
  }
}

function openQuote(line: DetailLine): void {
  activeLine.value = line
  quoteForm.supplierId = 0
  quoteForm.price = '0'
  quoteForm.leadDays = 0
  quoteForm.score = '0'
  quoteVisible.value = true
}

async function saveQuote(): Promise<void> {
  if (!activeLine.value) return
  try {
    await addQuote(activeLine.value.id, { ...quoteForm })
    quoteVisible.value = false
    ElMessage.success('报价已记录')
    const current = detail.value
    if (current) detail.value = await fetchRfqDetail(current.rfq.id)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function handleAward(quoteId: number): Promise<void> {
  try {
    await awardQuote(quoteId)
    ElMessage.success('已授标')
    const current = detail.value
    if (current) detail.value = await fetchRfqDetail(current.rfq.id)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '授标失败')
  }
}

onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>询价与比价</h2><p>多轮供应商报价、评分比较和授标；授标结果可转采购订单。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索项目" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'purchase:inquiry:create'" @click="openCreate">新建询价</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <div v-if="error" class="error">{{ error }}</div>
      <el-table v-loading="loading" :data="rows" row-key="id" @row-click="openDetail">
        <el-table-column prop="rfqNo" label="询价单号" width="170" />
        <el-table-column prop="projectName" label="项目名称" min-width="180" />
        <el-table-column prop="quoteDeadline" label="报价截止" width="130" />
        <el-table-column prop="status" label="状态" width="110" />
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="(value: number) => { query.page = value; void load() }" />
    </article>

    <el-dialog v-model="createVisible" title="新建询价" width="820px">
      <el-form label-width="90px">
        <el-form-item label="项目名称"><el-input v-model="form.projectName" /></el-form-item>
        <el-form-item label="报价截止"><el-date-picker v-model="form.quoteDeadline" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
      </el-form>
      <el-table :data="lines" size="small">
        <el-table-column label="产品ID" width="140">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'productId')" @update:model-value="setLineValue(row, 'productId', $event)" /></template>
        </el-table-column>
        <el-table-column label="数量" width="130">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'qty')" @update:model-value="setLineValue(row, 'qty', $event)" /></template>
        </el-table-column>
        <el-table-column label="目标价">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'targetPrice')" @update:model-value="setLineValue(row, 'targetPrice', $event)" /></template>
        </el-table-column>
        <el-table-column width="70">
          <template #default><el-button link type="danger" :disabled="lines.length <= 1" @click="lines.pop()">删</el-button></template>
        </el-table-column>
      </el-table>
      <el-button class="add-line" @click="lines.push({ productId: 0, qty: '1', targetPrice: '0' })">加行</el-button>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRfq">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="比价矩阵" width="1000px">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="询价单号">{{ detail.rfq.rfqNo }}</el-descriptions-item>
        <el-descriptions-item label="项目">{{ detail.rfq.projectName }}</el-descriptions-item>
      </el-descriptions>
      <div v-for="line in detail?.lines ?? []" :key="line.id" class="rfq-line">
        <div class="line-head">
          <span>产品 {{ line.productId }} · 数量 {{ line.qty }} · 目标价 {{ line.targetPrice }}</span>
          <el-button size="small" type="primary" @click="openQuote(line)">录入报价</el-button>
        </div>
        <el-table :data="line.quotes" size="small">
          <el-table-column prop="supplierId" label="供应商ID" width="120" />
          <el-table-column prop="price" label="报价" width="120" />
          <el-table-column prop="score" label="评分" width="100" />
          <el-table-column label="授标" width="100">
            <template #default="{ row }"><el-tag :type="row.awarded === 'YES' ? 'success' : 'info'">{{ row.awarded === 'YES' ? '已授标' : '未授标' }}</el-tag></template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ row }"><el-button link type="primary" :disabled="row.awarded === 'YES'" @click="handleAward(row.id)">授标</el-button></template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <el-dialog v-model="quoteVisible" title="录入供应商报价" width="520px">
      <el-form label-width="90px">
        <el-form-item label="供应商ID"><el-input-number v-model="quoteForm.supplierId" :min="1" /></el-form-item>
        <el-form-item label="报价"><el-input v-model="quoteForm.price" /></el-form-item>
        <el-form-item label="交期天数"><el-input-number v-model="quoteForm.leadDays" :min="0" /></el-form-item>
        <el-form-item label="评分"><el-input v-model="quoteForm.score" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="quoteVisible = false">取消</el-button>
        <el-button type="primary" @click="saveQuote">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.error { color: #f5222d; margin-bottom: 12px; }
.add-line { margin-top: 12px; }
.rfq-line { margin-top: 18px; padding: 12px; background: #f7f9fc; border-radius: 6px; }
.line-head { display: flex; justify-content: space-between; margin-bottom: 10px; }
</style>
