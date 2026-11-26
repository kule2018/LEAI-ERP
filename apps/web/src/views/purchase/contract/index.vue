<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createPurchaseContract, fetchPurchaseContracts } from '@/api/purchase'
import type { PageQuery } from '@/types/contract'

const rows = ref<Array<Record<string, unknown>>>([])
const total = ref(0)
const loading = ref(false)
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ supplierId: 0, title: '', startDate: '', endDate: '', totalAmount: '0' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchPurchaseContracts(query.value)
    if (current !== seq) return
    rows.value = result.list as unknown as Array<Record<string, unknown>>
    total.value = result.total
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
  finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { supplierId: 0, title: '', startDate: '', endDate: '', totalAmount: '0' }); visible.value = true }
async function save(): Promise<void> {
  try {
    await createPurchaseContract({ ...form })
    visible.value = false
    ElMessage.success('合同已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>采购合同</h2><p>维护框架协议、履约期间和合同金额。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索合同" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'purchase:contract:create'" @click="openAdd">新增合同</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="contractNo" label="合同编号" width="170" />
        <el-table-column prop="supplierId" label="供应商ID" width="110" />
        <el-table-column prop="title" label="合同标题" min-width="180" />
        <el-table-column prop="totalAmount" label="金额" width="140" />
        <el-table-column prop="status" label="状态" width="110" />
      </el-table>
    </article>
    <el-dialog v-model="visible" title="新增采购合同" width="520px">
      <el-form label-width="90px">
        <el-form-item label="供应商ID"><el-input-number v-model="form.supplierId" :min="1" /></el-form-item>
        <el-form-item label="合同标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="开始日期"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="结束日期"><el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="合同金额"><el-input v-model="form.totalAmount" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
