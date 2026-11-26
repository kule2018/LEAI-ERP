<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  carryForwardPeriod, closePeriod, fetchOpeningBalances, fetchPeriodCarries, fetchPeriods, fetchSubjects,
  reverseCarryForward, setOpeningBalances,
  type FinanceQuery, type FinPeriod, type OpeningBalance, type PeriodCarry, type Subject
} from '@/api/finance'

const rows = ref<FinPeriod[]>([])
const carries = ref<PeriodCarry[]>([])
const subjects = ref<Subject[]>([])
const openingBalances = ref<OpeningBalance[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<FinanceQuery>({ page: 1, pageSize: 20, keyword: '' })
const period = ref(new Date().toISOString().slice(0, 7))
const profitSubjectId = ref<number | undefined>(undefined)
const carryVisible = ref(false)
const carryForm = reactive({
  period: '',
  profitSubjectId: undefined as number | undefined,
  carrySubjectIds: [] as number[],
  targetSubjectId: undefined as number | undefined
})
const openingVisible = ref(false)
const openingForm = reactive({ period: '', items: [] as Array<{ subjectId: number | undefined; direction: string; amount: string }> })
let seq = 0

const profitSubjects = computed(() => subjects.value.filter((item) => item.category === 'EQUITY' || item.category === 'INCOME'))
const carrySubjects = computed(() => subjects.value.filter((item) => item.category === 'ASSET' || item.category === 'LIABILITY'))
const targetSubjects = computed(() => subjects.value.filter((item) => item.category === 'EQUITY' || item.category === 'LIABILITY' || item.category === 'ASSET'))

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchPeriods(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
async function loadCarries(): Promise<void> {
  try { const result = await fetchPeriodCarries({ page: 1, pageSize: 50, keyword: '' }); carries.value = result.list }
  catch { carries.value = [] }
}
async function loadSubjects(): Promise<void> {
  try {
    const result = await fetchSubjects({ page: 1, pageSize: 300, keyword: '' })
    subjects.value = result.list
  } catch { subjects.value = [] }
}
async function loadOpeningBalances(): Promise<void> {
  try { openingBalances.value = await fetchOpeningBalances(period.value) }
  catch { openingBalances.value = [] }
}
async function handleClose(): Promise<void> {
  try { await closePeriod(period.value); ElMessage.success('期间已结账'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '结账失败') }
}
function openCarry(): void {
  Object.assign(carryForm, {
    period: period.value,
    profitSubjectId: profitSubjectId.value,
    carrySubjectIds: [],
    targetSubjectId: undefined
  })
  carryVisible.value = true
}
async function submitCarry(): Promise<void> {
  if (!carryForm.period || !carryForm.profitSubjectId) { ElMessage.warning('请填写期间并选择本年利润科目'); return }
  if (carryForm.carrySubjectIds.length > 0 && !carryForm.targetSubjectId) { ElMessage.warning('指定科目结转需要选择目标科目'); return }
  try {
    const result = await carryForwardPeriod({
      period: carryForm.period,
      profitSubjectId: carryForm.profitSubjectId,
      carrySubjectIds: carryForm.carrySubjectIds.length > 0 ? carryForm.carrySubjectIds : undefined,
      targetSubjectId: carryForm.targetSubjectId
    })
    carryVisible.value = false
    ElMessage.success(`结转完成，本期利润 ${result.carry.profitAmount}`)
    await loadCarries()
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '结转失败') }
}
async function handleReverse(row: unknown): Promise<void> {
  const carry = row as PeriodCarry
  try {
    await reverseCarryForward(carry.period)
    ElMessage.success('已反结转')
    await loadCarries()
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '反结转失败') }
}
function openOpening(): void {
  Object.assign(openingForm, {
    period: period.value,
    items: [{ subjectId: undefined, direction: 'DEBIT', amount: '0' }]
  })
  openingVisible.value = true
}
function addOpeningRow(): void {
  openingForm.items.push({ subjectId: undefined, direction: 'DEBIT', amount: '0' })
}
function removeOpeningRow(index: number): void {
  openingForm.items.splice(index, 1)
}
async function submitOpening(): Promise<void> {
  const items = openingForm.items
    .filter((item) => item.subjectId && Number(item.amount) !== 0)
    .map((item) => ({ subjectId: item.subjectId as number, direction: item.direction, amount: item.amount }))
  if (items.length === 0) { ElMessage.warning('请至少录入一条期初余额'); return }
  try {
    await setOpeningBalances({ period: openingForm.period, items })
    openingVisible.value = false
    ElMessage.success('期初余额已保存')
    await loadOpeningBalances()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '期初余额保存失败') }
}
onMounted(async () => { await load(); await loadCarries(); await loadSubjects(); await loadOpeningBalances() })
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>月结</h2><p>结账前校验是否存在未过账凭证；期末结转把损益结转到本年利润，并支持指定科目结转与反结转。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-date-picker v-model="period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  />
        <el-button type="primary" v-perm="'finance:period:close'" @click="handleClose">结账</el-button>
        <el-button v-perm="'finance:period:carry'" @click="openCarry">期末结转</el-button>
        <el-button v-perm="'finance:period:carry'" @click="openOpening">期初余额录入</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="period" label="期间" width="140" />
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column prop="closedAt" label="结账时间" width="200" />
      </el-table>
    </article>
    <article class="panel">
      <h3>结转记录</h3>
      <el-table :data="carries" row-key="id">
        <el-table-column prop="period" label="期间" width="140" />
        <el-table-column prop="voucherId" label="结转凭证" width="120" />
        <el-table-column prop="totalAmount" label="结转金额" width="160" />
        <el-table-column prop="profitAmount" label="本期利润" width="160" />
        <el-table-column prop="subjectCount" label="涉及科目数" width="120" />
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column prop="createdAt" label="结转时间" width="200" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="danger" v-perm="'finance:period:carry'" :disabled="row.status !== 'DONE'" @click="handleReverse(row)">反结转</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>
    <article class="panel">
      <h3>期初余额（{{ period }}）</h3>
      <el-table :data="openingBalances" row-key="id">
        <el-table-column prop="subjectId" label="科目 ID" width="120" />
        <el-table-column prop="direction" label="方向" width="100" />
        <el-table-column prop="amount" label="金额" width="160" />
        <el-table-column prop="remark" label="备注" />
      </el-table>
    </article>
    <el-dialog v-model="carryVisible" title="期末结转" width="560px">
      <el-form label-width="110px">
        <el-form-item label="结转期间"><el-date-picker v-model="carryForm.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  /></el-form-item>
        <el-form-item label="本年利润科目">
          <el-select v-model="carryForm.profitSubjectId" filterable placeholder="选择科目" style="width: 100%">
            <el-option v-for="item in profitSubjects" :key="item.id" :label="`${item.subjectCode} ${item.subjectName}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="指定结转科目">
          <el-select v-model="carryForm.carrySubjectIds" multiple filterable placeholder="可选：库存/往来等科目" style="width: 100%">
            <el-option v-for="item in carrySubjects" :key="item.id" :label="`${item.subjectCode} ${item.subjectName}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="结转目标科目">
          <el-select v-model="carryForm.targetSubjectId" filterable placeholder="指定科目结转的目标科目" style="width: 100%">
            <el-option v-for="item in targetSubjects" :key="item.id" :label="`${item.subjectCode} ${item.subjectName}`" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="carryVisible = false">取消</el-button><el-button type="primary" @click="submitCarry">执行结转</el-button></template>
    </el-dialog>
    <el-dialog v-model="openingVisible" title="期初余额录入" width="640px">
      <el-form label-width="100px">
        <el-form-item label="期间"><el-date-picker v-model="openingForm.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  /></el-form-item>
      </el-form>
      <el-table :data="openingForm.items" size="small">
        <el-table-column label="科目" min-width="220">
          <template #default="{ row }">
            <el-select v-model="row.subjectId" filterable placeholder="选择科目" style="width: 100%">
              <el-option v-for="item in subjects" :key="item.id" :label="`${item.subjectCode} ${item.subjectName}`" :value="item.id" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="方向" width="130">
          <template #default="{ row }">
            <el-select v-model="row.direction" style="width: 100%">
              <el-option label="借" value="DEBIT" />
              <el-option label="贷" value="CREDIT" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="160">
          <template #default="{ row }"><el-input v-model="row.amount" /></template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ $index }"><el-button link type="danger" @click="removeOpeningRow($index)">删除</el-button></template>
        </el-table-column>
      </el-table>
      <el-button style="margin-top: 8px" @click="addOpeningRow">新增一行</el-button>
      <template #footer><el-button @click="openingVisible = false">取消</el-button><el-button type="primary" @click="submitOpening">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.panel h3 { margin: 0 0 12px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
