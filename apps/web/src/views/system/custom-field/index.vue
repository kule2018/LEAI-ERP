<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BaseGrid from '@/components/BaseGrid.vue'
import ViewConfigToolbar from '@/components/ViewConfigToolbar.vue'
import { useViewConfig } from '@/utils/view-config'
import {
  createCustomField,
  deleteCustomField,
  fetchCustomFields,
  updateCustomField,
  type CustomField,
  type CustomFieldOption,
  type CustomFieldPayload
} from '@/api/custom-field'
import type { GridColumn, PageQuery } from '@/types/contract'

const FIELD_TYPES = [
  { label: '文本', value: 'TEXT' },
  { label: '数字', value: 'NUMBER' },
  { label: '日期', value: 'DATE' },
  { label: '日期时间', value: 'DATETIME' },
  { label: '下拉选择', value: 'SELECT' },
  { label: '多选', value: 'MULTI_SELECT' },
  { label: '布尔', value: 'BOOLEAN' },
  { label: '引用单据', value: 'REFERENCE' }
]

const VIEW_PAGE_KEY = 'system.custom-field'

const columns: GridColumn[] = [
  { prop: 'entityCode', label: '业务对象', width: 150 },
  { prop: 'fieldKey', label: '字段标识', width: 150 },
  { prop: 'fieldLabel', label: '字段名称', width: 160 },
  { prop: 'fieldType', label: '字段类型', width: 110 },
  { prop: 'groupName', label: '所属分组', width: 120 },
  { prop: 'required', label: '必填', width: 80, align: 'center' },
  { prop: 'displayOrder', label: '排序', width: 80, align: 'center' },
  { prop: 'status', label: '状态', width: 100 }
]

const view = useViewConfig(VIEW_PAGE_KEY, columns)

const rows = ref<CustomField[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const entityFilter = ref('')
const drawerVisible = ref(false)
const isEdit = ref(false)
const editingId = ref(0)
const submitting = ref(false)
const optionsText = ref('')
const form = ref<Record<string, unknown>>(createEmptyForm())

let requestSeq = 0

function createEmptyForm(): Record<string, unknown> {
  return {
    entityCode: '',
    fieldKey: '',
    fieldLabel: '',
    fieldType: 'TEXT',
    groupName: '基础信息',
    displayOrder: 0,
    maxLength: 0,
    min: undefined,
    max: undefined,
    pattern: '',
    referenceType: '',
    required: false,
    visibleInList: true,
    allowFilter: false,
    remark: ''
  }
}

const typeLabel = computed(() => FIELD_TYPES.find((item) => item.value === form.value.fieldType)?.label ?? '')
const submitPerm = computed(() => (isEdit.value ? 'system:custom-field:update' : 'system:custom-field:create'))

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchCustomFields({
      page: query.value.page,
      pageSize: query.value.pageSize,
      keyword: query.value.keyword,
      entityCode: entityFilter.value || undefined
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
  optionsText.value = ''
  drawerVisible.value = true
}

function formatOptions(options: CustomFieldOption[] | null): string {
  return (options ?? []).map((option) => `${option.label}:${option.value}`).join('\n')
}

function parseOptions(text: string): CustomFieldOption[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf(':')
      if (index < 0) return { label: line, value: line }
      return { label: line.slice(0, index).trim(), value: line.slice(index + 1).trim() }
    })
}

function openEdit(row: unknown): void {
  const field = row as CustomField
  isEdit.value = true
  editingId.value = field.id
  form.value = {
    entityCode: field.entityCode,
    fieldKey: field.fieldKey,
    fieldLabel: field.fieldLabel,
    fieldType: field.fieldType,
    groupName: field.groupName,
    displayOrder: field.displayOrder,
    maxLength: field.maxLength ?? 0,
    min: field.minValue === null ? undefined : Number(field.minValue),
    max: field.maxValue === null ? undefined : Number(field.maxValue),
    pattern: field.pattern ?? '',
    referenceType: field.referenceType ?? '',
    required: field.required === 1,
    visibleInList: field.visibleInList === 1,
    allowFilter: field.allowFilter === 1,
    remark: field.remark ?? ''
  }
  optionsText.value = formatOptions(field.options)
  drawerVisible.value = true
}

function buildPayload(): CustomFieldPayload {
  const type = String(form.value.fieldType ?? 'TEXT')
  const payload: CustomFieldPayload = {
    fieldLabel: String(form.value.fieldLabel ?? ''),
    fieldType: type,
    groupName: String(form.value.groupName ?? '基础信息'),
    displayOrder: Number(form.value.displayOrder ?? 0),
    maxLength: Number(form.value.maxLength ?? 0) || undefined,
    min: form.value.min === undefined ? undefined : Number(form.value.min),
    max: form.value.max === undefined ? undefined : Number(form.value.max),
    pattern: String(form.value.pattern ?? ''),
    referenceType: String(form.value.referenceType ?? ''),
    required: form.value.required === true,
    visibleInList: form.value.visibleInList === true,
    allowFilter: form.value.allowFilter === true,
    remark: String(form.value.remark ?? '')
  }
  if (type === 'SELECT' || type === 'MULTI_SELECT') {
    payload.options = parseOptions(optionsText.value)
  }
  if (!isEdit.value) {
    payload.entityCode = String(form.value.entityCode ?? '')
    payload.fieldKey = String(form.value.fieldKey ?? '')
  }
  return payload
}

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    const payload = buildPayload()
    if (isEdit.value) {
      await updateCustomField(editingId.value, payload)
    } else {
      await createCustomField(payload)
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
  const field = row as CustomField
  await ElMessageBox.confirm(`确认删除字段「${field.fieldLabel}」？`, '提示', { type: 'warning' })
  await deleteCustomField(field.id)
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
      <h2>自定义字段</h2>
      <p>为业务单据动态扩展字段：按业务对象维护字段定义，支持类型、必填、候选值、显示条件与分组。</p>
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
      perm-prefix="system:custom-field"
      @refresh="load"
      @add="openAdd"
      @edit="openEdit"
      @delete="handleDelete"
      @update:page="handlePage"
      @update:page-size="handlePageSize"
    >
      <template #toolbar>
        <ViewConfigToolbar
          page-key="system.custom-field"
          :columns="columns"
          :view="view"
          title="自定义字段"
          route="/system/custom-field"
        />
        <el-input v-model="entityFilter" placeholder="业务对象编码" clearable @keyup.enter="load" />
        <el-input v-model="query.keyword" placeholder="搜索字段名称" clearable @keyup.enter="load" />
      </template>
    </BaseGrid>

    <el-drawer v-model="drawerVisible" :title="isEdit ? '编辑自定义字段' : '新增自定义字段'" size="620px">
      <el-form label-width="110px">
        <el-form-item label="业务对象" required>
          <el-input v-model="form.entityCode" :disabled="isEdit" placeholder="如 SALE_ORDER" />
        </el-form-item>
        <el-form-item label="字段标识" required>
          <el-input v-model="form.fieldKey" :disabled="isEdit" placeholder="如 customer_level" />
        </el-form-item>
        <el-form-item label="字段名称" required>
          <el-input v-model="form.fieldLabel" />
        </el-form-item>
        <el-form-item label="字段类型" required>
          <el-select v-model="form.fieldType" style="width: 100%">
            <el-option v-for="item in FIELD_TYPES" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属分组">
          <el-input v-model="form.groupName" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.displayOrder" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item v-if="form.fieldType === 'TEXT'" label="最大长度">
          <el-input-number v-model="form.maxLength" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item v-if="form.fieldType === 'NUMBER'" label="数值范围">
          <el-input-number v-model="form.min" :precision="4" controls-position="right" style="width: 45%" />
          <el-input-number v-model="form.max" :precision="4" controls-position="right" style="width: 45%; margin-left: 8px" />
        </el-form-item>
        <el-form-item v-if="form.fieldType === 'REFERENCE'" label="引用类型">
          <el-input v-model="form.referenceType" placeholder="如 customer" />
        </el-form-item>
        <el-form-item v-if="form.fieldType === 'SELECT' || form.fieldType === 'MULTI_SELECT'" label="候选值">
          <el-input v-model="optionsText" type="textarea" :rows="4" placeholder="每行一个，格式：标签:值" />
        </el-form-item>
        <el-form-item label="校验正则">
          <el-input v-model="form.pattern" placeholder="选填，如 ^[A-Z]{2}$" />
        </el-form-item>
        <el-form-item label="必填">
          <el-switch v-model="form.required" />
        </el-form-item>
        <el-form-item label="列表显示">
          <el-switch v-model="form.visibleInList" />
        </el-form-item>
        <el-form-item label="可用于筛选">
          <el-switch v-model="form.allowFilter" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="drawer-footer">
          <span class="drawer-tip">当前类型：{{ typeLabel }}</span>
          <el-button @click="drawerVisible = false">取消</el-button>
          <el-button v-perm="submitPerm" type="primary" :loading="submitting" @click="handleSubmit">
            保存
          </el-button>
        </div>
      </template>
    </el-drawer>
  </section>
</template>

<style scoped>
.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--erp-space-2);
}

.drawer-tip {
  margin-right: auto;
  font-size: 12px;
  color: #646a73;
}
</style>
