<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import BaseDrawer from '@/components/BaseDrawer.vue'
import BaseGrid from '@/components/BaseGrid.vue'
import ViewConfigToolbar from '@/components/ViewConfigToolbar.vue'
import { useViewConfig } from '@/utils/view-config'
import { createContract, fetchContracts, type SaleContract } from '@/api/sales'
import type { FieldDef, GridColumn, PageQuery } from '@/types/contract'

const VIEW_PAGE_KEY = 'sales.contract'

const columns: GridColumn[] = [
  { prop: 'contractNo', label: '合同编号', width: 160 },
  { prop: 'customerId', label: '客户ID', width: 110 },
  { prop: 'title', label: '合同标题', width: 200 },
  { prop: 'startDate', label: '开始日期', width: 130 },
  { prop: 'endDate', label: '结束日期', width: 130 },
  { prop: 'totalAmount', label: '合同金额', width: 140 },
  { prop: 'status', label: '状态', width: 110 }
]

const view = useViewConfig(VIEW_PAGE_KEY, columns)

const fields: FieldDef[] = [
  { key: 'customerId', label: '客户ID', type: 'int', required: true },
  { key: 'title', label: '合同标题', type: 'input', required: true, maxlength: 150 },
  { key: 'startDate', label: '开始日期', type: 'input', maxlength: 10 },
  { key: 'endDate', label: '结束日期', type: 'input', maxlength: 10 },
  { key: 'totalAmount', label: '合同金额', type: 'input', required: true }
]

const rows = ref<SaleContract[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const drawerVisible = ref(false)
const submitting = ref(false)
const form = ref<Record<string, unknown>>({ customerId: 0, title: '', startDate: '', endDate: '', totalAmount: '0' })
let requestSeq = 0

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchContracts(query.value)
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
  form.value = { customerId: 0, title: '', startDate: '', endDate: '', totalAmount: '0' }
  drawerVisible.value = true
}

async function save(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    await createContract({
      customerId: Number(form.value.customerId),
      title: String(form.value.title),
      startDate: String(form.value.startDate) || undefined,
      endDate: String(form.value.endDate) || undefined,
      totalAmount: String(form.value.totalAmount)
    })
    drawerVisible.value = false
    ElMessage.success('合同已创建')
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
      <h2>销售合同</h2>
      <p>维护合同金额和履约周期；合同变更需保留版本，本阶段提供创建入口。</p>
    </header>
    <BaseGrid
      :columns="view.visibleColumns.value" :density="view.density.value"
      :rows="rows" :loading="loading" :error="error" :total="total"
      :page="query.page" :page-size="query.pageSize" perm-prefix="sales:contract"
      @refresh="load" @add="openAdd" @update:page="handlePage" @update:page-size="handlePageSize"
    >
      <template #toolbar>
        <ViewConfigToolbar
          page-key="sales.contract"
          :columns="columns"
          :view="view"
          title="销售合同"
          route="/sales/contract"
        />
        <el-input v-model="query.keyword" placeholder="搜索合同" clearable @keyup.enter="load" />
      </template>
    </BaseGrid>
    <BaseDrawer
      v-model="drawerVisible" title="新增销售合同" :fields="fields" :form="form" :loading="submitting"
      submit-perm="sales:contract:create" @update:form="form = $event" @submit="save"
    />
  </section>
</template>
