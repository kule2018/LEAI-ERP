<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createLocation,
  createWarehouse,
  deleteLocation,
  fetchLocations,
  fetchWarehouses,
  type Location,
  type Warehouse
} from '@/api/master-data'
import type { PageQuery } from '@/types/contract'

const rows = ref<Warehouse[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const selected = ref<Warehouse | null>(null)
const locations = ref<Location[]>([])
const detailLoading = ref(false)
const dialogVisible = ref(false)
const form = reactive({ warehouseCode: '', warehouseName: '', address: '', manager: '', isDefault: 'NO' })
const locationForm = reactive({ locationCode: '', locationName: '', zoneCode: '' })

let requestSeq = 0
let detailSeq = 0

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchWarehouses(query.value)
    if (seq !== requestSeq) return
    rows.value = result.list
    total.value = result.total
    if (!selected.value && result.list.length > 0) selected.value = result.list[0]
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function loadLocations(value: Warehouse | null): Promise<void> {
  if (!value) {
    locations.value = []
    return
  }
  const seq = ++detailSeq
  detailLoading.value = true
  try {
    const result = await fetchLocations(value.id)
    if (seq === detailSeq) locations.value = result
  } catch (cause) {
    if (seq === detailSeq) error.value = cause instanceof Error ? cause.message : '库位加载失败'
  } finally {
    if (seq === detailSeq) detailLoading.value = false
  }
}

watch(selected, (value) => {
  void loadLocations(value)
})

function selectRow(row: unknown): void {
  selected.value = row as Warehouse
}

function openCreate(): void {
  form.warehouseCode = ''
  form.warehouseName = ''
  form.address = ''
  form.manager = ''
  form.isDefault = 'NO'
  dialogVisible.value = true
}

async function saveWarehouse(): Promise<void> {
  try {
    await createWarehouse({ ...form })
    dialogVisible.value = false
    ElMessage.success('仓库已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function saveLocation(): Promise<void> {
  if (!selected.value) return
  try {
    await createLocation(selected.value.id, { ...locationForm })
    locationForm.locationCode = ''
    locationForm.locationName = ''
    locationForm.zoneCode = ''
    ElMessage.success('库位已创建')
    await loadLocations(selected.value)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function removeLocation(row: unknown): Promise<void> {
  if (!selected.value) return
  const location = row as Location
  await ElMessageBox.confirm(`确认删除库位「${location.locationCode}」？`, '提示', { type: 'warning' })
  await deleteLocation(selected.value.id, location.id)
  ElMessage.success('已删除')
  await loadLocations(selected.value)
}

function defaultLabel(row: unknown): string {
  return (row as Warehouse).isDefault === 1 ? '默认' : '普通'
}

onMounted(load)
onUnmounted(() => {
  requestSeq += 1
  detailSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>仓库库位</h2>
      <p>仓库下维护库位；后续库存余额以仓库、库位、产品、SKU、批次为唯一维度。</p>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="warehouse-layout">
      <article class="panel">
        <div class="panel-toolbar">
          <el-input v-model="query.keyword" placeholder="搜索仓库" clearable @keyup.enter="load" />
          <el-button type="primary" v-perm="'inventory:warehouse:create'" @click="openCreate">新增仓库</el-button>
          <el-button @click="load">刷新</el-button>
        </div>
        <el-table v-loading="loading" :data="rows" row-key="id" highlight-current-row @row-click="selectRow">
          <el-table-column prop="warehouseCode" label="仓库编码" width="120" />
          <el-table-column prop="warehouseName" label="仓库名称" min-width="140" />
          <el-table-column prop="manager" label="负责人" width="100" />
          <el-table-column label="类型" width="80">
            <template #default="{ row }"><el-tag :type="defaultLabel(row) === '默认' ? 'success' : 'info'">{{ defaultLabel(row) }}</el-tag></template>
          </el-table-column>
        </el-table>
        <el-pagination background layout="prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" />
      </article>

      <article class="panel" v-loading="detailLoading">
        <div class="detail-header">
          <h3>{{ selected?.warehouseName ?? '库位管理' }}</h3>
          <span v-if="selected">{{ selected.address || '未维护地址' }}</span>
        </div>
        <div class="inline-form">
          <el-input v-model="locationForm.locationCode" placeholder="库位编码" />
          <el-input v-model="locationForm.locationName" placeholder="库位名称" />
          <el-input v-model="locationForm.zoneCode" placeholder="库区" />
          <el-button type="primary" :disabled="!selected" v-perm="'inventory:warehouse:update'" @click="saveLocation">添加库位</el-button>
        </div>
        <el-table :data="locations" row-key="id" size="small">
          <el-table-column prop="locationCode" label="库位编码" width="140" />
          <el-table-column prop="locationName" label="库位名称" min-width="150" />
          <el-table-column prop="zoneCode" label="库区" width="100" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column label="操作" width="80">
            <template #default="{ row }"><el-button link type="danger" @click="removeLocation(row)">删除</el-button></template>
          </el-table-column>
        </el-table>
      </article>
    </div>

    <el-dialog v-model="dialogVisible" title="新增仓库" width="520px">
      <el-form label-width="90px">
        <el-form-item label="仓库编码"><el-input v-model="form.warehouseCode" /></el-form-item>
        <el-form-item label="仓库名称"><el-input v-model="form.warehouseName" /></el-form-item>
        <el-form-item label="地址"><el-input v-model="form.address" /></el-form-item>
        <el-form-item label="负责人"><el-input v-model="form.manager" /></el-form-item>
        <el-form-item label="默认仓库">
          <el-select v-model="form.isDefault">
            <el-option label="否" value="NO" />
            <el-option label="是" value="YES" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveWarehouse">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.warehouse-layout { display: grid; grid-template-columns: minmax(360px, 0.9fr) minmax(460px, 1.1fr); gap: 16px; }
.panel { min-width: 0; padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.detail-header h3 { margin: 0; }
.inline-form { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.error-banner { margin-bottom: 16px; padding: 12px 16px; color: #f5222d; background: #fff1f0; border-radius: 8px; }
@media (max-width: 1100px) { .warehouse-layout { grid-template-columns: 1fr; } }
</style>
