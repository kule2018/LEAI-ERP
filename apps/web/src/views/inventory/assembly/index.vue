<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { approveAssembly, createAssembly, fetchAssemblies, type Assembly, type InventoryQuery } from '@/api/inventory'

const rows = ref<Assembly[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<InventoryQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ assemblyType: 'ASSEMBLY', productId: 0, warehouseId: 0, qty: '1' })
const lines = ref([{ productId: 0, qty: '1' }])
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchAssemblies(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void {
  Object.assign(form, { assemblyType: 'ASSEMBLY', productId: 0, warehouseId: 0, qty: '1' })
  lines.value = [{ productId: 0, qty: '1' }]
  visible.value = true
}
async function save(): Promise<void> {
  try {
    await createAssembly({ ...form, lines: lines.value })
    visible.value = false
    ElMessage.success('拆装单已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function approve(row: unknown): Promise<void> {
  const assembly = row as Assembly
  try { await approveAssembly(assembly.id); ElMessage.success('拆装已过账'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '过账失败') }
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>拆装管理</h2><p>组装按 BOM 组件出库、成品入库；拆解按相反方向过账。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'inventory:assembly:create'" @click="openAdd">新建拆装</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="assemblyNo" label="单号" width="170" />
        <el-table-column prop="assemblyType" label="类型" width="130" />
        <el-table-column prop="productId" label="目标产品" width="120" />
        <el-table-column prop="warehouseId" label="仓库ID" width="110" />
        <el-table-column prop="qty" label="数量" width="110" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="100"><template #default="{ row }"><el-button link type="primary" v-perm="'inventory:assembly:approve'" @click="approve(row)">过账</el-button></template></el-table-column>
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
    <el-dialog v-model="visible" title="新建拆装" width="760px">
      <el-form label-width="90px">
        <el-form-item label="类型"><el-select v-model="form.assemblyType"><el-option label="组装" value="ASSEMBLY" /><el-option label="拆解" value="DISASSEMBLY" /></el-select></el-form-item>
        <el-form-item label="目标产品ID"><el-input-number v-model="form.productId" :min="1" /></el-form-item>
        <el-form-item label="仓库ID"><el-input-number v-model="form.warehouseId" :min="1" /></el-form-item>
        <el-form-item label="数量"><el-input v-model="form.qty" /></el-form-item>
      </el-form>
      <el-table :data="lines" size="small">
        <el-table-column label="组件产品ID" width="160"><template #default="{ row }"><el-input v-model="row.productId" /></template></el-table-column>
        <el-table-column label="单件用量"><template #default="{ row }"><el-input v-model="row.qty" /></template></el-table-column>
        <el-table-column width="70"><template #default><el-button link type="danger" :disabled="lines.length <= 1" @click="lines.pop()">删</el-button></template></el-table-column>
      </el-table>
      <el-button class="add-line" @click="lines.push({ productId: 0, qty: '1' })">加行</el-button>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.add-line { margin-top: 12px; }
</style>
