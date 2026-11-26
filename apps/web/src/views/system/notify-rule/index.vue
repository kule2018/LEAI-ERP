<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BaseDrawer from '@/components/BaseDrawer.vue'
import BaseGrid from '@/components/BaseGrid.vue'
import ViewConfigToolbar from '@/components/ViewConfigToolbar.vue'
import { useViewConfig } from '@/utils/view-config'
import {
  createNotifyRule,
  deleteNotifyRule,
  fetchNotifyRules,
  updateNotifyRule,
  type NotifyRule,
  type NotifyRulePayload
} from '@/api/notify-rule'
import type { FieldDef, GridColumn, PageQuery } from '@/types/contract'

const LEVELS = [
  { label: '低', value: 'LOW' },
  { label: '中', value: 'MEDIUM' },
  { label: '高', value: 'HIGH' },
  { label: '严重', value: 'CRITICAL' }
]

const RECEIVER_TYPES = [
  { label: '指定用户', value: 'USER' },
  { label: '指定角色', value: 'ROLE' },
  { label: '业务负责人', value: 'BIZ_OWNER' },
  { label: '全员', value: 'ALL' }
]

const EVENT_TYPES = [
  { label: '销售订单提交', value: 'SALE_ORDER_SUBMIT' },
  { label: '库存预警', value: 'STOCK_ALERT' },
  { label: '风险预警', value: 'RISK_ALERT' },
  { label: '安全告警', value: 'SECURITY_ALERT' }
]

const CHANNEL_OPTIONS = [
  { label: '站内信', value: 'INMAIL' },
  { label: '邮件', value: 'EMAIL' },
  { label: '短信', value: 'SMS' },
  { label: '企业微信', value: 'WECOM' },
  { label: '钉钉', value: 'DINGTALK' }
]

const VIEW_PAGE_KEY = 'system.notify-rule'

const columns: GridColumn[] = [
  { prop: 'ruleCode', label: '规则编码', width: 220 },
  { prop: 'ruleName', label: '规则名称', width: 180 },
  { prop: 'eventType', label: '事件类型', width: 180 },
  { prop: 'bizType', label: '业务域', width: 110 },
  { prop: 'templateCode', label: '通知模板', width: 180 },
  { prop: 'channels', label: '通知渠道', width: 170 },
  { prop: 'level', label: '级别', width: 90 },
  { prop: 'receiverType', label: '接收人类型', width: 120 },
  { prop: 'priority', label: '优先级', width: 90, align: 'center' },
  { prop: 'enabled', label: '启用', width: 80, align: 'center' }
]

const view = useViewConfig(VIEW_PAGE_KEY, columns)

const fields: FieldDef[] = [
  { key: 'ruleCode', label: '规则编码', type: 'input', required: true },
  { key: 'ruleName', label: '规则名称', type: 'input', required: true },
  { key: 'eventType', label: '事件类型', type: 'select', options: EVENT_TYPES, required: true },
  { key: 'bizType', label: '业务域', type: 'input', required: true },
  { key: 'templateCode', label: '通知模板编码', type: 'input', required: true },
  { key: 'channels', label: '通知渠道', type: 'select', options: CHANNEL_OPTIONS },
  { key: 'level', label: '级别', type: 'select', options: LEVELS },
  { key: 'receiverType', label: '接收人类型', type: 'select', options: RECEIVER_TYPES },
  { key: 'receiverIds', label: '接收人ID(逗号分隔)', type: 'input' },
  { key: 'priority', label: '优先级', type: 'int' },
  { key: 'enabled', label: '启用', type: 'select', options: [{ label: '是', value: '1' }, { label: '否', value: '0' }] },
  { key: 'description', label: '说明', type: 'textarea' }
]

const rows = ref<NotifyRule[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const eventTypeFilter = ref('')
const drawerVisible = ref(false)
const isEdit = ref(false)
const editingId = ref(0)
const submitting = ref(false)
const form = ref<Record<string, unknown>>(createEmptyForm())
const submitPerm = computed(() => (isEdit.value ? 'system:notify-rule:update' : 'system:notify-rule:create'))

let requestSeq = 0

function createEmptyForm(): Record<string, unknown> {
  return {
    ruleCode: '',
    ruleName: '',
    eventType: 'SALE_ORDER_SUBMIT',
    bizType: 'sales',
    templateCode: '',
    channels: 'INMAIL',
    level: 'MEDIUM',
    receiverType: 'ROLE',
    receiverIds: '',
    priority: 100,
    enabled: '1',
    description: ''
  }
}

function parseIds(value: unknown): number[] {
  return String(value ?? '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)
}

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchNotifyRules({
      page: query.value.page,
      pageSize: query.value.pageSize,
      keyword: query.value.keyword,
      eventType: eventTypeFilter.value || undefined
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
  const rule = row as NotifyRule
  isEdit.value = true
  editingId.value = rule.id
  form.value = {
    ruleCode: rule.ruleCode,
    ruleName: rule.ruleName,
    eventType: rule.eventType,
    bizType: rule.bizType,
    templateCode: rule.templateCode,
    channels: rule.channels ?? '',
    level: rule.level,
    receiverType: rule.receiverType,
    receiverIds: (rule.receiverIds ?? []).join(','),
    priority: rule.priority,
    enabled: rule.enabled === 1 ? '1' : '0',
    description: rule.description ?? ''
  }
  drawerVisible.value = true
}

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  const payload: NotifyRulePayload = {
    ruleName: String(form.value.ruleName ?? ''),
    eventType: String(form.value.eventType ?? ''),
    bizType: String(form.value.bizType ?? ''),
    templateCode: String(form.value.templateCode ?? ''),
    channels: String(form.value.channels ?? ''),
    level: String(form.value.level ?? 'MEDIUM'),
    receiverType: String(form.value.receiverType ?? 'ROLE'),
    receiverIds: parseIds(form.value.receiverIds),
    priority: Number(form.value.priority ?? 100),
    enabled: String(form.value.enabled ?? '1') === '1',
    description: String(form.value.description ?? '')
  }
  try {
    if (isEdit.value) {
      await updateNotifyRule(editingId.value, payload)
    } else {
      await createNotifyRule({ ...payload, ruleCode: String(form.value.ruleCode ?? '') })
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
  const rule = row as NotifyRule
  await ElMessageBox.confirm(`确认删除规则「${rule.ruleName}」？`, '提示', { type: 'warning' })
  await deleteNotifyRule(rule.id)
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
      <h2>通知规则</h2>
      <p>统一维护「业务事件 → 通知模板 + 渠道 + 接收人」的映射，规则启用后由事件派发接口自动投递。</p>
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
      perm-prefix="system:notify-rule"
      @refresh="load"
      @add="openAdd"
      @edit="openEdit"
      @delete="handleDelete"
      @update:page="handlePage"
      @update:page-size="handlePageSize"
    >
      <template #toolbar>
        <ViewConfigToolbar
          page-key="system.notify-rule"
          :columns="columns"
          :view="view"
          title="通知规则"
          route="/system/notify-rule"
        />
        <el-select v-model="eventTypeFilter" placeholder="事件类型" clearable style="width: 200px">
          <el-option v-for="item in EVENT_TYPES" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="搜索规则名称" clearable @keyup.enter="load" />
      </template>
    </BaseGrid>

    <BaseDrawer
      v-model="drawerVisible"
      title="通知规则"
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
