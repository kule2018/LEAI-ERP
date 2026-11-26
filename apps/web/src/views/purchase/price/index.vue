<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createPurchasePrice, fetchPurchasePrices } from '@/api/purchase'
import type { PageQuery } from '@/types/contract'

const rows = ref<Array<Record<string, unknown>>>([])
const total = ref(0)
const loading = ref(false)
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ supplierId: 0, productId: 0, price: '0', startDate: '', endDate: '' })
let seq = 0
async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchPurchasePrices(query.value)
    if (current !== seq) return
    rows.value = result.list as unknown as Array<Record<string, unknown>>
    total.value = result.total
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
  finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { supplierId: 0, productId: 0, price: '0', startDate: '', endDate: '' }); visible.value = true }
async function save(): Promise<void> {
  try {
    await createPurchasePrice({ ...form })
    visible.value = false
    ElMessage.success('价目已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>采购价目</h2><p>按供应商和产品维护采购价及有效期；下单时自动参考有效价格。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索产品ID" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'purchase:price:create'" @click="openAdd">新增价目</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="supplierId" label="供应商ID" width="120" />
        <el-table-column prop="productId" label="产品ID" width="110" />
        <el-table-column prop="price" label="采购价" width="140" />
        <el-table-column prop="startDate" label="生效日" width="130" />
        <el-table-column prop="endDate" label="到期日" width="130" />
        <el-table-column prop="status" label="状态" width="110" />
      </el-table>
    </article>
    <el-dialog v-model="visible" title="新增采购价目" width="520px">
      <el-form label-width="90px">
        <el-form-item label="供应商ID"><el-input-number v-model="form.supplierId" :min="1" /></el-form-item>
        <el-form-item label="产品ID"><el-input-number v-model="form.productId" :min="1" /></el-form-item>
        <el-form-item label="采购价"><el-input v-model="form.price" /></el-form-item>
        <el-form-item label="生效日"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="到期日"><el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
