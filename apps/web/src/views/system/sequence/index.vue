<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BaseDrawer from '@/components/BaseDrawer.vue'
import BaseGrid from '@/components/BaseGrid.vue'
import ViewConfigToolbar from '@/components/ViewConfigToolbar.vue'
import { useViewConfig } from '@/utils/view-config'
import {
  createSequence,
  deleteSequence,
  fetchSequences,
  nextSequence,
  updateSequence,
  type SequenceRule
} from '@/api/sequence'
import type { FieldDef, GridColumn, PageQuery } from '@/types/contract'

const VIEW_PAGE_KEY = 'system.sequence'

const columns: GridColumn[] = [
  { prop: 'bizCode', label: '业务编码', width: 150 },
  { prop: 'bizName', label: '业务名称', width: 160 },
  { prop: 'numberPrefix', label: '前缀', width: 120 },
  { prop: 'dateFormat', label: '日期格式', width: 140 },
  { prop: 'currentSeq', label: '当前序号', width: 120 },
  { prop: 'docNo', label: '最近单号', width: 200 }
]

const view = useViewConfig(VIEW_PAGE_KEY, columns)

const fields: FieldDef[] = [
  { key: 'bizCode', label: '业务编码', type: 'input', required: true, maxlength: 50 },
  { key: 'bizName', label: '业务名称', type: 'input', maxlength: 100 },
  { key: 'numberPrefix', label: '单号前缀', type: 'input', required: true, maxlength: 20 },
  { key: 'dateFormat', label: '日期格式', type: 'input', maxlength: 20 },
  { key: 'stepValue', label: '步长', type: 'int', required: true },
  { key: 'resetCycle', label: '重置周期', type: 'select', options: [
    { label: '每日', value: 'DAILY' },
    { label: '每月', value: 'MONTHLY' },
    { label: '每年', value: 'YEARLY' }
  ] }
]

const rows = ref<SequenceRule[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const drawerVisible = ref(false)
const isEdit = ref(false)
const editingId = ref(0)
const submitting = ref(false)
const form = ref<Record<string, unknown>>(createEmptyForm())
const preview = ref('')
const previewKey = ref('')

let requestSeq = 0

function createEmptyForm(): Record<string, unknown> {
  return {
    bizCode: '',
    bizName: '',
    numberPrefix: '',
    dateFormat: 'yyyyMMdd',
    stepValue: 1,
    resetCycle: 'DAILY'
  }
}

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchSequences(query.value)
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
  const rule = row as SequenceRule
  isEdit.value = true
  editingId.value = rule.id
  form.value = { ...createEmptyForm(), ...rule }
  drawerVisible.value = true
}

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    const payload = { ...form.value } as Record<string, unknown>
    if (isEdit.value) {
      await updateSequence(editingId.value, {
        bizName: String(payload.bizName ?? ''),
        numberPrefix: String(payload.numberPrefix ?? ''),
        dateFormat: String(payload.dateFormat ?? 'yyyyMMdd'),
        stepValue: Number(payload.stepValue ?? 1),
        resetCycle: String(payload.resetCycle ?? 'DAILY')
      })
    } else {
      await createSequence({
        bizCode: String(payload.bizCode ?? ''),
        bizName: String(payload.bizName ?? ''),
        numberPrefix: String(payload.numberPrefix ?? ''),
        dateFormat: String(payload.dateFormat ?? 'yyyyMMdd'),
        stepValue: Number(payload.stepValue ?? 1),
        resetCycle: String(payload.resetCycle ?? 'DAILY')
      })
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
  const rule = row as SequenceRule
  await ElMessageBox.confirm(`确认删除规则「${rule.bizName || rule.bizCode}」？`, '提示', { type: 'warning' })
  await deleteSequence(rule.id)
  ElMessage.success('已删除')
  await load()
}

async function handlePreview(row: unknown): Promise<void> {
  const rule = row as SequenceRule
  try {
    const result = await nextSequence(rule.bizCode)
    preview.value = result.docNo
    previewKey.value = result.redisKey
    ElMessage.success('已生成单号')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '生成失败')
  }
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
      <h2>编码规则</h2>
      <p>按业务编码维护单号规则，基于 Redis 原子递增取号，按天分桶并自动过期。</p>
    </header>

    <article class="preview-panel">
      <span>单号预览</span>
      <strong>{{ preview || '尚未生成' }}</strong>
      <code v-if="previewKey">{{ previewKey }}</code>
    </article>

    <BaseGrid
      :columns="view.visibleColumns.value"
      :density="view.density.value"
      :rows="rows"
      :loading="loading"
      :error="error"
      :total="total"
      :page="query.page"
      :page-size="query.pageSize"
      perm-prefix="system:sequence"
      @refresh="load"
      @add="openAdd"
      @edit="openEdit"
      @delete="handleDelete"
      @update:page="handlePage"
      @update:page-size="handlePageSize"
    >
      <template #toolbar>
        <ViewConfigToolbar
          page-key="system.sequence"
          :columns="columns"
          :view="view"
          title="流水号规则"
          route="/system/sequence"
        />
        <el-input v-model="query.keyword" placeholder="搜索业务编码" clearable @keyup.enter="load" />
        <el-button v-perm="'system:sequence:next'" @click="rows.length > 0 && handlePreview(rows[0])">生成首个规则单号</el-button>
      </template>
    </BaseGrid>

    <BaseDrawer
      v-model="drawerVisible"
      :title="isEdit ? '编辑编码规则' : '新增编码规则'"
      :fields="fields"
      :form="form"
      :loading="submitting"
      :is-edit="isEdit"
      submit-perm="system:sequence:update"
      @update:form="form = $event"
      @submit="handleSubmit"
    />
  </section>
</template>

<style scoped>
.preview-panel {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.preview-panel span {
  color: #646a73;
}

.preview-panel strong {
  font-size: 20px;
}

.preview-panel code {
  color: #646a73;
}
</style>
