<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import BaseDrawer from '@/components/BaseDrawer.vue'
import BaseGrid from '@/components/BaseGrid.vue'
import ViewConfigToolbar from '@/components/ViewConfigToolbar.vue'
import { useViewConfig } from '@/utils/view-config'
import { createClause, fetchClauses, updateClause, type SaleClause } from '@/api/sales'
import type { FieldDef, GridColumn, PageQuery } from '@/types/contract'

const VIEW_PAGE_KEY = 'sales.clause'

const columns: GridColumn[] = [
  { prop: 'clauseCode', label: '条款编码', width: 140 },
  { prop: 'clauseTitle', label: '条款标题', width: 220 },
  { prop: 'category', label: '分类', width: 140 },
  { prop: 'status', label: '状态', width: 100 },
  { prop: 'clauseContent', label: '条款内容', width: 320 }
]

const view = useViewConfig(VIEW_PAGE_KEY, columns)

const fields: FieldDef[] = [
  { key: 'clauseCode', label: '条款编码', type: 'input', required: true, maxlength: 60 },
  { key: 'clauseTitle', label: '条款标题', type: 'input', required: true, maxlength: 150 },
  { key: 'category', label: '分类', type: 'input', maxlength: 60 },
  { key: 'clauseContent', label: '条款内容', type: 'textarea' }
]

const rows = ref<SaleClause[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const drawerVisible = ref(false)
const submitting = ref(false)
const editingId = ref<number | null>(null)
const form = ref<Record<string, unknown>>({ clauseCode: '', clauseTitle: '', category: '', clauseContent: '' })
let requestSeq = 0

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchClauses(query.value)
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
  editingId.value = null
  form.value = { clauseCode: '', clauseTitle: '', category: '', clauseContent: '' }
  drawerVisible.value = true
}

function openEdit(row: unknown): void {
  const item = row as SaleClause
  editingId.value = item.id
  form.value = {
    clauseCode: item.clauseCode,
    clauseTitle: item.clauseTitle,
    category: item.category ?? '',
    clauseContent: item.clauseContent ?? ''
  }
  drawerVisible.value = true
}

async function save(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  const payload = {
    clauseCode: String(form.value.clauseCode).trim(),
    clauseTitle: String(form.value.clauseTitle).trim(),
    category: String(form.value.category) || undefined,
    clauseContent: String(form.value.clauseContent ?? '') || undefined
  }
  try {
    if (editingId.value) await updateClause(editingId.value, payload)
    else await createClause(payload)
    drawerVisible.value = false
    ElMessage.success('条款已保存')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    submitting.value = false
  }
}

function handlePage(value: number): void { query.value.page = value; void load() }
function handlePageSize(value: number): void { query.value.pageSize = value; void load() }

onMounted(load)
onUnmounted(() => { requestSeq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>合同条款库</h2>
      <p>维护可复用的合同条款，供合同引用并在续签时自动继承。</p>
    </header>

    <BaseGrid
      :columns="view.visibleColumns.value" :density="view.density.value"
      :rows="rows" :loading="loading" :error="error" :total="total"
      :page="query.page" :page-size="query.pageSize" perm-prefix="sales:clause"
      @refresh="load" @add="openAdd" @edit="openEdit" @update:page="handlePage" @update:page-size="handlePageSize"
    >
      <template #toolbar>
        <ViewConfigToolbar
          page-key="sales.clause"
          :columns="columns"
          :view="view"
          title="合同条款"
          route="/sales/clause"
        />
        <el-input v-model="query.keyword" placeholder="搜索条款" clearable @keyup.enter="load" />
      </template>
    </BaseGrid>

    <BaseDrawer
      v-model="drawerVisible" :title="editingId ? '编辑条款' : '新增条款'" :fields="fields" :form="form" :loading="submitting"
      :is-edit="!!editingId" submit-perm="sales:clause:manage" @update:form="form = $event" @submit="save"
    />
  </section>
</template>
