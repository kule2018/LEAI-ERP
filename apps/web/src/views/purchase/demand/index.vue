<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import BaseDrawer from '@/components/BaseDrawer.vue'
import BaseGrid from '@/components/BaseGrid.vue'
import ViewConfigToolbar from '@/components/ViewConfigToolbar.vue'
import { useViewConfig } from '@/utils/view-config'
import { createDemand, fetchDemands, type Demand } from '@/api/purchase'
import type { FieldDef, GridColumn, PageQuery } from '@/types/contract'

const VIEW_PAGE_KEY = 'purchase.demand'

const columns: GridColumn[] = [
  { prop: 'demandNo', label: '需求单号', width: 160 },
  { prop: 'productId', label: '产品ID', width: 110 },
  { prop: 'qty', label: '需求数量', width: 130 },
  { prop: 'sourceType', label: '来源', width: 120 },
  { prop: 'status', label: '状态', width: 110 }
]

const view = useViewConfig(VIEW_PAGE_KEY, columns)
const fields: FieldDef[] = [
  { key: 'productId', label: '产品ID', type: 'int', required: true },
  { key: 'qty', label: '需求数量', type: 'input', required: true },
  { key: 'sourceType', label: '来源', type: 'select', options: [
    { label: '手工', value: 'MANUAL' },
    { label: 'MRP', value: 'MRP' },
    { label: '安全库存', value: 'SAFETY' }
  ] }
]
const rows = ref<Demand[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const submitting = ref(false)
const form = ref<Record<string, unknown>>({ productId: 0, qty: '1', sourceType: 'MANUAL' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchDemands(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    if (current === seq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (current === seq) loading.value = false
  }
}
function openAdd(): void {
  form.value = { productId: 0, qty: '1', sourceType: 'MANUAL' }
  visible.value = true
}
async function save(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    await createDemand({ ...form.value })
    visible.value = false
    ElMessage.success('需求已创建')
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
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>采购需求</h2><p>支持手工、MRP 和安全库存来源；需求合并和预算校验将在后续增强。</p></header>
    <BaseGrid :columns="view.visibleColumns.value" :density="view.density.value" :rows="rows" :loading="loading" :error="error" :total="total" :page="query.page" :page-size="query.pageSize" perm-prefix="purchase:demand" @refresh="load" @add="openAdd" @update:page="handlePage" @update:page-size="handlePageSize">
      <template #toolbar>
        <ViewConfigToolbar
          page-key="purchase.demand"
          :columns="columns"
          :view="view"
          title="采购需求"
          route="/purchase/demand"
        />
        <el-input v-model="query.keyword" placeholder="搜索需求单" clearable @keyup.enter="load" />
      </template>
    </BaseGrid>
    <BaseDrawer v-model="visible" title="新增采购需求" :fields="fields" :form="form" :loading="submitting" submit-perm="purchase:demand:create" @update:form="form = $event" @submit="save" />
  </section>
</template>
