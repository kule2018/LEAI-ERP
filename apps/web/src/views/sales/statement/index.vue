<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createStatement, fetchCollectionPlan, fetchStatements, fetchWriteoffSuggestion,
  generateCollectionLetter, reverseStatement, settleStatement, type Statement
} from '@/api/sales'
import type { PageQuery } from '@/types/contract'

const rows = ref<Statement[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const selected = ref<Statement | null>(null)
const dialogVisible = ref(false)
const settleVisible = ref(false)
const form = reactive({ customerId: 0, period: '', amount: '0', dueDate: '' })
const settleForm = reactive({ amount: '' })
const reverseVisible = ref(false)
const reverseForm = reactive({ amount: '', reason: '' })
const collectionPlan = ref<Array<Record<string, unknown>>>([])
const suggestion = ref<Record<string, unknown> | null>(null)
const letter = ref('')
let requestSeq = 0

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchStatements(query.value)
    if (seq !== requestSeq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function selectRow(row: unknown): void { selected.value = row as Statement }

function openCreate(): void {
  form.customerId = 0
  form.period = new Date().toISOString().slice(0, 7)
  form.amount = '0'
  form.dueDate = ''
  dialogVisible.value = true
}

async function save(): Promise<void> {
  try {
    await createStatement({
      customerId: form.customerId,
      period: form.period,
      amount: form.amount,
      dueDate: form.dueDate || undefined
    })
    dialogVisible.value = false
    ElMessage.success('对账单已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

function openSettle(row: unknown): void {
  selected.value = row as Statement
  const statement = row as Statement
  settleForm.amount = String(Math.max(0, Number(statement.amount) - Number(statement.settledAmount)))
  settleVisible.value = true
}

async function handleSettle(): Promise<void> {
  if (!selected.value) return
  try {
    await settleStatement(selected.value.id, settleForm.amount)
    settleVisible.value = false
    ElMessage.success('核销成功')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '核销失败')
  }
}

async function handleCollectionPlan(): Promise<void> {
  try {
    collectionPlan.value = await fetchCollectionPlan()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载收款计划失败')
  }
}

async function handleSuggestion(row: Statement): Promise<void> {
  try {
    suggestion.value = await fetchWriteoffSuggestion(row.id)
    settleForm.amount = String(suggestion.value.suggested ?? '')
    settleVisible.value = true
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '获取建议失败')
  }
}

async function handleLetter(row: Statement): Promise<void> {
  try {
    const result = await generateCollectionLetter(row.id)
    letter.value = result.content
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '生成催收函失败')
  }
}

function openReverse(row: unknown): void {
  selected.value = row as Statement
  const statement = row as Statement
  const remaining = Number(statement.amount) - Number(statement.settledAmount) - Number(statement.reversedAmount ?? 0)
  reverseForm.amount = String(Math.max(0, Number(remaining.toFixed(4))))
  reverseForm.reason = ''
  reverseVisible.value = true
}

async function handleReverse(): Promise<void> {
  if (!selected.value) return
  if (!reverseForm.reason.trim()) { ElMessage.warning('请填写红冲原因'); return }
  try {
    await reverseStatement(selected.value.id, reverseForm.amount, reverseForm.reason.trim())
    reverseVisible.value = false
    ElMessage.success('红冲成功，客户信用占用已同步释放')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '红冲失败')
  }
}

function progress(row: unknown): number {
  const statement = row as Statement
  const totalAmount = Number(statement.amount)
  return totalAmount > 0 ? Math.round((Number(statement.settledAmount) / totalAmount) * 100) : 0
}

onMounted(load)
onUnmounted(() => { requestSeq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>客户对账</h2>
      <p>按客户期间生成账单，支持部分核销；核销后释放对应客户信用占用。</p>
    </header>
    <article class="panel">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索对账单号" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'sales:statement:create'" @click="openCreate">生成账单</el-button>
        <el-button v-perm="'sales:statement:view'" @click="handleCollectionPlan">收款计划</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <div v-if="error" class="error">{{ error }}</div>
      <el-table v-loading="loading" :data="rows" row-key="id" highlight-current-row @row-click="selectRow">
        <el-table-column prop="statementNo" label="账单号" width="160" />
        <el-table-column prop="customerId" label="客户ID" width="100" />
        <el-table-column prop="period" label="期间" width="110" />
        <el-table-column prop="amount" label="账单金额" width="140" />
        <el-table-column prop="settledAmount" label="已核销" width="140" />
        <el-table-column prop="reversedAmount" label="已红冲" width="120" />
        <el-table-column label="核销进度" min-width="180">
          <template #default="{ row }"><el-progress :percentage="progress(row)" /></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="220">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'sales:statement:view'" @click.stop="handleSuggestion(row)">智能核销</el-button>
            <el-button link type="warning" v-perm="'sales:statement:settle'" @click.stop="handleLetter(row)">催收函</el-button>
            <el-button link type="primary" v-perm="'sales:statement:settle'" @click.stop="openSettle(row)">核销</el-button>
            <el-button link type="danger" v-perm="'sales:statement:reverse'" @click.stop="openReverse(row)">红冲</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="collectionPlan.length" class="plan">
        <h3>收款计划</h3>
        <el-table :data="collectionPlan" size="small">
          <el-table-column prop="id" label="账单 ID" width="100" />
          <el-table-column prop="overdueDays" label="逾期天数" width="110" />
          <el-table-column prop="level" label="分级" width="120" />
          <el-table-column prop="actionDate" label="下次动作" min-width="180" />
        </el-table>
      </div>
      <div v-if="letter" class="letter">{{ letter }}</div>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="(value: number) => { query.page = value; void load() }" />
    </article>

    <el-dialog v-model="dialogVisible" title="生成对账单" width="520px">
      <el-form label-width="90px">
        <el-form-item label="客户ID"><el-input-number v-model="form.customerId" :min="1" /></el-form-item>
        <el-form-item label="期间"><el-date-picker v-model="form.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  /></el-form-item>
        <el-form-item label="金额"><el-input v-model="form.amount" /></el-form-item>
        <el-form-item label="到期日"><el-date-picker v-model="form.dueDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="settleVisible" title="核销账单" width="460px">
      <el-descriptions v-if="selected" :column="2" border>
        <el-descriptions-item label="账单">{{ selected.statementNo }}</el-descriptions-item>
        <el-descriptions-item label="金额">{{ selected.amount }}</el-descriptions-item>
      </el-descriptions>
      <el-form label-width="90px" class="settle-form">
        <el-form-item label="核销金额"><el-input v-model="settleForm.amount" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="settleVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSettle">确认核销</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reverseVisible" title="对账单红冲" width="460px">
      <el-descriptions v-if="selected" :column="2" border>
        <el-descriptions-item label="账单">{{ selected.statementNo }}</el-descriptions-item>
        <el-descriptions-item label="账单金额">{{ selected.amount }}</el-descriptions-item>
        <el-descriptions-item label="已核销">{{ selected.settledAmount }}</el-descriptions-item>
        <el-descriptions-item label="已红冲">{{ selected.reversedAmount ?? 0 }}</el-descriptions-item>
      </el-descriptions>
      <el-form label-width="90px" class="settle-form">
        <el-form-item label="红冲金额"><el-input v-model="reverseForm.amount" /></el-form-item>
        <el-form-item label="红冲原因"><el-input v-model="reverseForm.reason" type="textarea" :rows="3" placeholder="红冲原因（必填）" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reverseVisible = false">取消</el-button>
        <el-button type="danger" @click="handleReverse">确认红冲</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.error { color: #f5222d; margin-bottom: 12px; }
.settle-form { margin-top: 16px; }
.plan { margin-top: 16px; }
.plan h3 { font-size: 14px; margin: 0 0 8px; }
.letter { margin-top: 16px; padding: 12px; background: #f6ffed; border-radius: 6px; color: #237804; }
</style>
