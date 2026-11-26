<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import BaseDrawer from '@/components/BaseDrawer.vue'
import BaseGrid from '@/components/BaseGrid.vue'
import ViewConfigToolbar from '@/components/ViewConfigToolbar.vue'
import { useViewConfig } from '@/utils/view-config'
import { createEvaluate, fetchEvaluates, type Evaluate } from '@/api/purchase'
import type { FieldDef, GridColumn, PageQuery } from '@/types/contract'

const VIEW_PAGE_KEY = 'purchase.evaluate'

const columns: GridColumn[] = [
  { prop: 'supplierId', label: '供应商ID', width: 120 },
  { prop: 'period', label: '期间', width: 110 },
  { prop: 'totalScore', label: '总分', width: 110 },
  { prop: 'level', label: '等级', width: 90 }
]

const view = useViewConfig(VIEW_PAGE_KEY, columns)
const fields: FieldDef[] = [
  { key: 'supplierId', label: '供应商ID', type: 'int', required: true },
  { key: 'period', label: '评估期间', type: 'input', required: true },
  { key: 'qualityScore', label: '质量分', type: 'input', required: true },
  { key: 'deliveryScore', label: '交付分', type: 'input', required: true },
  { key: 'priceScore', label: '价格分', type: 'input', required: true },
  { key: 'serviceScore', label: '服务分', type: 'input', required: true }
]
const rows = ref<Evaluate[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const submitting = ref(false)
const form = ref<Record<string, unknown>>({ supplierId: 0, period: '', qualityScore: '0', deliveryScore: '0', priceScore: '0', serviceScore: '0' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchEvaluates(query.value)
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
  form.value = { supplierId: 0, period: new Date().toISOString().slice(0, 7), qualityScore: '0', deliveryScore: '0', priceScore: '0', serviceScore: '0' }
  visible.value = true
}

async function save(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    await createEvaluate({ ...form.value })
    visible.value = false
    ElMessage.success('评级已保存')
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
    <header class="page-header"><h2>供应商评级</h2><p>质量、交付、价格、服务四维评分，自动回写供应商评级分。</p></header>
    <BaseGrid :columns="view.visibleColumns.value" :density="view.density.value" :rows="rows" :loading="loading" :error="error" :total="total" :page="query.page" :page-size="query.pageSize" perm-prefix="purchase:supplier" @refresh="load" @add="openAdd" @update:page="handlePage" @update:page-size="handlePageSize">
      <template #toolbar>
        <ViewConfigToolbar
          page-key="purchase.evaluate"
          :columns="columns"
          :view="view"
          title="供应商评估"
          route="/purchase/evaluate"
        />
        <el-input v-model="query.keyword" placeholder="搜索期间" clearable @keyup.enter="load" />
      </template>
    </BaseGrid>
    <BaseDrawer v-model="visible" title="新增评级" :fields="fields" :form="form" :loading="submitting" submit-perm="purchase:supplier:update" @update:form="form = $event" @submit="save" />
  </section>
</template>
