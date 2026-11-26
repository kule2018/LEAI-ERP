<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { activateBom, createBom, fetchBomDetail, fetchBoms, type Bom, type BomItem } from '@/api/manufacturing'
import type { ManufacturingQuery } from '@/api/manufacturing'

const rows = ref<Bom[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<ManufacturingQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const detailVisible = ref(false)
const detail = ref<{ bom: Bom; items: BomItem[] } | null>(null)
const form = reactive({ productId: 0, version: '', baseQty: '1', remark: '' })
const items = ref([{ materialId: 0, qty: '1', lossRate: '0' }])
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchBoms(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { productId: 0, version: '', baseQty: '1', remark: '' }); items.value = [{ materialId: 0, qty: '1', lossRate: '0' }]; visible.value = true }
async function save(): Promise<void> {
  try {
    await createBom({ ...form, items: items.value })
    visible.value = false
    ElMessage.success('BOM 已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function openDetail(row: unknown): Promise<void> {
  const bom = row as Bom
  try { detail.value = await fetchBomDetail(bom.id); detailVisible.value = true }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '详情加载失败') }
}
async function activate(row: unknown): Promise<void> {
  const bom = row as Bom
  try { await activateBom(bom.id); ElMessage.success('BOM 已启用'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '启用失败') }
}
function isActive(row: unknown): boolean { return (row as Bom).isActive === 1 }
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>BOM</h2><p>按产品和版本维护物料清单，启用版本唯一。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'mfg:bom:create'" @click="openAdd">新建 BOM</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id" @row-click="openDetail">
        <el-table-column prop="productId" label="产品ID" width="110" />
        <el-table-column prop="version" label="版本" width="130" />
        <el-table-column prop="baseQty" label="基准量" width="120" />
        <el-table-column label="启用" width="100"><template #default="{ row }"><el-tag :type="isActive(row) ? 'success' : 'info'">{{ isActive(row) ? '已启用' : '草稿' }}</el-tag></template></el-table-column>
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="100"><template #default="{ row }"><el-button link type="primary" v-perm="'mfg:bom:approve'" :disabled="isActive(row)" @click.stop="activate(row)">启用</el-button></template></el-table-column>
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
    <el-dialog v-model="visible" title="新建 BOM" width="760px">
      <el-form label-width="90px">
        <el-form-item label="产品ID"><el-input-number v-model="form.productId" :min="1" /></el-form-item>
        <el-form-item label="版本"><el-input v-model="form.version" /></el-form-item>
        <el-form-item label="基准量"><el-input v-model="form.baseQty" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" /></el-form-item>
      </el-form>
      <el-table :data="items" size="small">
        <el-table-column label="物料ID" width="150"><template #default="{ row }"><el-input v-model="row.materialId" /></template></el-table-column>
        <el-table-column label="用量" width="130"><template #default="{ row }"><el-input v-model="row.qty" /></template></el-table-column>
        <el-table-column label="损耗率%"><template #default="{ row }"><el-input v-model="row.lossRate" /></template></el-table-column>
        <el-table-column width="70"><template #default><el-button link type="danger" :disabled="items.length <= 1" @click="items.pop()">删</el-button></template></el-table-column>
      </el-table>
      <el-button class="add-line" @click="items.push({ materialId: 0, qty: '1', lossRate: '0' })">加行</el-button>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="detailVisible" title="BOM 明细" width="720px">
      <el-table v-if="detail" :data="detail.items" size="small">
        <el-table-column prop="materialId" label="物料ID" />
        <el-table-column prop="qty" label="用量" />
        <el-table-column prop="lossRate" label="损耗率" />
        <el-table-column prop="substituteMaterialId" label="替代料" />
      </el-table>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.add-line { margin-top: 12px; }
</style>
