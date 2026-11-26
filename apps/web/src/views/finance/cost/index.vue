<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createCost, fetchCosts, type Cost, type FinanceQuery } from '@/api/finance'

const rows = ref<Cost[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<FinanceQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ productId: 0, period: '', costType: 'MATERIAL', amount: '0' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchCosts(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { productId: 0, period: new Date().toISOString().slice(0, 7), costType: 'MATERIAL', amount: '0' }); visible.value = true }
async function save(): Promise<void> {
  try { await createCost({ ...form }); visible.value = false; ElMessage.success('成本记录已保存'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>成本重算</h2><p>按产品和期间归集材料、人工和制造成本。</p></header>
    <article class="panel">
      <div class="toolbar"><el-button type="primary" v-perm="'finance:cost:create'" @click="openAdd">新增成本</el-button><el-button @click="load">刷新</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="productId" label="产品ID" width="120" />
        <el-table-column prop="period" label="期间" width="120" />
        <el-table-column prop="costType" label="成本类型" width="140" />
        <el-table-column prop="amount" label="金额" width="160" />
      </el-table>
    </article>
    <el-dialog v-model="visible" title="新增成本记录" width="520px">
      <el-form label-width="90px">
        <el-form-item label="产品ID"><el-input-number v-model="form.productId" :min="1" /></el-form-item>
        <el-form-item label="期间"><el-date-picker v-model="form.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  /></el-form-item>
        <el-form-item label="成本类型"><el-input v-model="form.costType" /></el-form-item>
        <el-form-item label="金额"><el-input v-model="form.amount" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
