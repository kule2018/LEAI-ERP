<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BaseGrid from '@/components/BaseGrid.vue'
import ViewConfigToolbar from '@/components/ViewConfigToolbar.vue'
import { useViewConfig } from '@/utils/view-config'
import {
  createCustomForm,
  deleteCustomForm,
  fetchCustomForms,
  updateCustomForm,
  type CustomForm,
  type CustomFormPayload
} from '@/api/custom-field'
import type { GridColumn, PageQuery } from '@/types/contract'

const VIEW_PAGE_KEY = 'system.custom-form'

const columns: GridColumn[] = [
  { prop: 'formCode', label: '表单编码', width: 160 },
  { prop: 'formName', label: '表单名称', width: 180 },
  { prop: 'entityCode', label: '业务对象', width: 160 },
  { prop: 'version', label: '版本', width: 90, align: 'center' },
  { prop: 'status', label: '状态', width: 100 },
  { prop: 'remark', label: '备注', width: 180 },
  { prop: 'createdAt', label: '创建时间', width: 170 }
]

const view = useViewConfig(VIEW_PAGE_KEY, columns)

const rows = ref<CustomForm[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const entityFilter = ref('')
const drawerVisible = ref(false)
const isEdit = ref(false)
const editingId = ref(0)
const submitting = ref(false)
const layoutText = ref('')
const form = ref<Record<string, unknown>>(createEmptyForm())

let requestSeq = 0

function createEmptyForm(): Record<string, unknown> {
  return {
    formCode: '',
    formName: '',
    entityCode: '',
    status: 'ACTIVE',
    remark: ''
  }
}

const submitPerm = computed(() => (isEdit.value ? 'system:custom-form:update' : 'system:custom-form:create'))

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchCustomForms({
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
  layoutText.value = '[]'
  drawerVisible.value = true
}

function openEdit(row: unknown): void {
  const item = row as CustomForm
  isEdit.value = true
  editingId.value = item.id
  form.value = {
    formCode: item.formCode,
    formName: item.formName,
    entityCode: item.entityCode,
    status: item.status,
    remark: item.remark ?? ''
  }
  layoutText.value = JSON.stringify(item.layout ?? [], null, 2)
  drawerVisible.value = true
}

function parseLayout(text: string): Array<Record<string, unknown>> {
  const trimmed = text.trim()
  if (!trimmed) return []
  const parsed = JSON.parse(trimmed)
  if (!Array.isArray(parsed)) throw new Error('布局必须是 JSON 数组')
  return parsed as Array<Record<string, unknown>>
}

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    const payload: CustomFormPayload = {
      formName: String(form.value.formName ?? ''),
      entityCode: String(form.value.entityCode ?? ''),
      status: String(form.value.status ?? 'ACTIVE'),
      remark: String(form.value.remark ?? ''),
      layout: parseLayout(layoutText.value)
    }
    if (isEdit.value) {
      await updateCustomForm(editingId.value, payload)
    } else {
      await createCustomForm({ ...payload, formCode: String(form.value.formCode ?? '') })
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
  const item = row as CustomForm
  await ElMessageBox.confirm(`确认删除表单「${item.formName}」？`, '提示', { type: 'warning' })
  await deleteCustomForm(item.id)
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
      <h2>自定义表单</h2>
      <p>按业务对象维护表单布局：分组、页签与控件顺序，配合自定义字段实现表单动态渲染。</p>
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
      perm-prefix="system:custom-form"
      @refresh="load"
      @add="openAdd"
      @edit="openEdit"
      @delete="handleDelete"
      @update:page="handlePage"
      @update:page-size="handlePageSize"
    >
      <template #toolbar>
        <ViewConfigToolbar
          page-key="system.custom-form"
          :columns="columns"
          :view="view"
          title="自定义表单"
          route="/system/custom-form"
        />
        <el-input v-model="entityFilter" placeholder="业务对象编码" clearable @keyup.enter="load" />
        <el-input v-model="query.keyword" placeholder="搜索表单名称" clearable @keyup.enter="load" />
      </template>
    </BaseGrid>

    <el-drawer v-model="drawerVisible" :title="isEdit ? '编辑自定义表单' : '新增自定义表单'" size="640px">
      <el-form label-width="110px">
        <el-form-item label="表单编码" required>
          <el-input v-model="form.formCode" :disabled="isEdit" placeholder="如 sale_order_form" />
        </el-form-item>
        <el-form-item label="表单名称" required>
          <el-input v-model="form.formName" />
        </el-form-item>
        <el-form-item label="业务对象" required>
          <el-input v-model="form.entityCode" placeholder="如 SALE_ORDER" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="布局配置">
          <el-input v-model="layoutText" type="textarea" :rows="12" placeholder='JSON 数组，如 [{"group":"基础信息","fields":[]}]' />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="drawer-footer">
          <el-button @click="drawerVisible = false">取消</el-button>
          <el-button v-perm="submitPerm" type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
        </div>
      </template>
    </el-drawer>
  </section>
</template>

<style scoped>
.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--erp-space-2);
}
</style>
