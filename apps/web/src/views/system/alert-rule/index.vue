<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BaseDrawer from '@/components/BaseDrawer.vue'
import BaseGrid from '@/components/BaseGrid.vue'
import ViewConfigToolbar from '@/components/ViewConfigToolbar.vue'
import { useViewConfig } from '@/utils/view-config'
import {
  createAlertRule,
  deleteAlertRule,
  fetchAlertRules,
  updateAlertRule,
  type AlertRule,
  type AlertRulePayload
} from '@/api/alert-rule'
import type { FieldDef, GridColumn, PageQuery } from '@/types/contract'

const COMPARATORS = [
  { label: '大于', value: 'GT' },
  { label: '大于等于', value: 'GTE' },
  { label: '小于', value: 'LT' },
  { label: '小于等于', value: 'LTE' },
  { label: '等于', value: 'EQ' },
  { label: '不等于', value: 'NEQ' }
]

const SEVERITIES = [
  { label: '提示', value: 'INFO' },
  { label: '低', value: 'LOW' },
  { label: '中', value: 'MEDIUM' },
  { label: '高', value: 'HIGH' },
  { label: '严重', value: 'CRITICAL' }
]

const BIZ_TYPES = [
  { label: '风险告警', value: 'risk_alert' },
  { label: '安全告警', value: 'security_alert' },
  { label: '运维监控', value: 'ops_monitor' },
  { label: '库存告警', value: 'stock_alert' }
]

const METRICS = [
  { label: '信用超限高危比例', value: 'CREDIT_OVER_RATIO' },
  { label: '库存低于安全线高危比例', value: 'STOCK_CRITICAL_RATIO' },
  { label: '应收逾期中危天数', value: 'AR_MEDIUM_DAYS' },
  { label: '应收逾期高危天数', value: 'AR_HIGH_DAYS' },
  { label: '越权访问告警次数', value: 'SECURITY_UNAUTHORIZED_ATTEMPTS' },
  { label: '慢请求耗时阈值', value: 'OPS_SLOW_REQUEST_MS' },
  { label: '错误率告警阈值', value: 'OPS_ERROR_RATE' }
]

const VIEW_PAGE_KEY = 'system.alert-rule'

const columns: GridColumn[] = [
  { prop: 'ruleCode', label: '规则编码', width: 220 },
  { prop: 'ruleName', label: '规则名称', width: 180 },
  { prop: 'bizType', label: '业务域', width: 120 },
  { prop: 'metric', label: '监控指标', width: 210 },
  { prop: 'comparator', label: '比较符', width: 90 },
  { prop: 'threshold', label: '阈值', width: 100, align: 'right' },
  { prop: 'windowMinutes', label: '窗口(分钟)', width: 110, align: 'center' },
  { prop: 'severity', label: '严重度', width: 100 },
  { prop: 'enabled', label: '启用', width: 80, align: 'center' }
]

const view = useViewConfig(VIEW_PAGE_KEY, columns)

const fields: FieldDef[] = [
  { key: 'ruleCode', label: '规则编码', type: 'input', required: true },
  { key: 'ruleName', label: '规则名称', type: 'input', required: true },
  { key: 'bizType', label: '业务域', type: 'select', options: BIZ_TYPES },
  { key: 'metric', label: '监控指标', type: 'select', options: METRICS },
  { key: 'comparator', label: '比较符', type: 'select', options: COMPARATORS },
  { key: 'threshold', label: '阈值', type: 'decimal' },
  { key: 'windowMinutes', label: '窗口(分钟)', type: 'int' },
  { key: 'severity', label: '严重度', type: 'select', options: SEVERITIES },
  { key: 'enabled', label: '启用', type: 'select', options: [{ label: '是', value: '1' }, { label: '否', value: '0' }] },
  { key: 'description', label: '说明', type: 'textarea' }
]

const rows = ref<AlertRule[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const bizTypeFilter = ref('')
const metricFilter = ref('')
const drawerVisible = ref(false)
const isEdit = ref(false)
const editingId = ref(0)
const submitting = ref(false)
const form = ref<Record<string, unknown>>(createEmptyForm())
const submitPerm = computed(() => (isEdit.value ? 'system:alert-rule:update' : 'system:alert-rule:create'))

let requestSeq = 0

function createEmptyForm(): Record<string, unknown> {
  return {
    ruleCode: '',
    ruleName: '',
    bizType: 'risk_alert',
    metric: 'CREDIT_OVER_RATIO',
    comparator: 'GTE',
    threshold: 0,
    windowMinutes: 0,
    severity: 'MEDIUM',
    enabled: '1',
    description: ''
  }
}

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchAlertRules({
      page: query.value.page,
      pageSize: query.value.pageSize,
      keyword: query.value.keyword,
      bizType: bizTypeFilter.value || undefined,
      metric: metricFilter.value || undefined
    })
    if (seq !== requestSeq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function openAdd(): void {
  isEdit.value = false
  editingId.value = 0
  form.value = createEmptyForm()
  drawerVisible.value = true
}

function openEdit(row: unknown): void {
  const rule = row as AlertRule
  isEdit.value = true
  editingId.value = rule.id
  form.value = {
    ruleCode: rule.ruleCode,
    ruleName: rule.ruleName,
    bizType: rule.bizType,
    metric: rule.metric,
    comparator: rule.comparator,
    threshold: Number(rule.threshold),
    windowMinutes: rule.windowMinutes,
    severity: rule.severity,
    enabled: rule.enabled === 1 ? '1' : '0',
    description: rule.description ?? ''
  }
  drawerVisible.value = true
}

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  const payload: AlertRulePayload = {
    ruleName: String(form.value.ruleName ?? ''),
    bizType: String(form.value.bizType ?? ''),
    metric: String(form.value.metric ?? ''),
    comparator: String(form.value.comparator ?? 'GTE'),
    threshold: Number(form.value.threshold ?? 0),
    windowMinutes: Number(form.value.windowMinutes ?? 0),
    severity: String(form.value.severity ?? 'MEDIUM'),
    enabled: String(form.value.enabled ?? '1') === '1',
    description: String(form.value.description ?? '')
  }
  try {
    if (isEdit.value) {
      await updateAlertRule(editingId.value, payload)
    } else {
      await createAlertRule({ ...payload, ruleCode: String(form.value.ruleCode ?? '') })
    }
    drawerVisible.value = false
    ElMessage.success('保存成功')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: unknown): Promise<void> {
  const rule = row as AlertRule
  await ElMessageBox.confirm(`确认删除规则「${rule.ruleName}」？`, '提示', { type: 'warning' })
  await deleteAlertRule(rule.id)
  ElMessage.success('已删除')
  await load()
}

function handlePage(value: number): void {
  query.value.page = value
  void load()
}

function handlePageSize(value: number): void {
  query.value.pageSize = value
  void load()
}

onMounted(load)
onUnmounted(() => {
  requestSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>告警规则</h2>
      <p>统一维护风险、库存、安全与运维各域的告警阈值，规则变更后即时生效并广播到运行时。</p>
    </header>

    <BaseGrid
      :columns="view.visibleColumns.value"
      :density="view.density.value"
      :rows="rows"
      :loading="loading"
      :error="error"
      :total="total"
      :page="query.page"
      :page-size="query.pageSize"
      perm-prefix="system:alert-rule"
      @refresh="load"
      @add="openAdd"
      @edit="openEdit"
      @delete="handleDelete"
      @update:page="handlePage"
      @update:page-size="handlePageSize"
    >
      <template #toolbar>
        <ViewConfigToolbar
          page-key="system.alert-rule"
          :columns="columns"
          :view="view"
          title="告警规则"
          route="/system/alert-rule"
        />
        <el-select v-model="bizTypeFilter" placeholder="业务域" clearable style="width: 140px">
          <el-option v-for="item in BIZ_TYPES" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="metricFilter" placeholder="监控指标" clearable style="width: 220px">
          <el-option v-for="item in METRICS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="搜索规则名称" clearable @keyup.enter="load" />
      </template>
    </BaseGrid>

    <BaseDrawer
      v-model="drawerVisible"
      title="告警规则"
      :fields="fields"
      :form="form"
      :loading="submitting"
      :is-edit="isEdit"
      :submit-perm="submitPerm"
      @update:form="form = $event"
      @submit="handleSubmit"
    />
  </section>
</template>
