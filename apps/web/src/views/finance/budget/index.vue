<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createBudget, fetchBudgets, type Budget, type FinanceQuery } from '@/api/finance'

const rows = ref<Budget[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<FinanceQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ period: '', deptId: 0, subjectId: 0, budgetAmount: '0', controlRule: 'WARN' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchBudgets(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { period: new Date().toISOString().slice(0, 7), deptId: 0, subjectId: 0, budgetAmount: '0', controlRule: 'WARN' }); visible.value = true }
async function save(): Promise<void> {
  try {
    await createBudget({ ...form, deptId: form.deptId || undefined, subjectId: form.subjectId || undefined })
    visible.value = false
    ElMessage.success('预算已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
function progress(row: unknown): number {
  const item = row as Budget
  const amount = Number(item.budgetAmount)
  return amount > 0 ? Math.round((Number(item.usedAmount) / amount) * 100) : 0
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>预算管理</h2><p>期间、部门、科目维度的预算和控制策略。</p></header>
    <article class="panel">
      <div class="toolbar"><el-button type="primary" v-perm="'finance:budget:create'" @click="openAdd">新增预算</el-button><el-button @click="load">刷新</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="period" label="期间" width="120" />
        <el-table-column prop="deptId" label="部门ID" width="110" />
        <el-table-column prop="subjectId" label="科目ID" width="110" />
        <el-table-column prop="budgetAmount" label="预算金额" width="150" />
        <el-table-column prop="usedAmount" label="已用金额" width="150" />
        <el-table-column label="执行率" min-width="180"><template #default="{ row }"><el-progress :percentage="progress(row)" /></template></el-table-column>
        <el-table-column prop="controlRule" label="控制策略" width="120" />
      </el-table>
    </article>
    <el-dialog v-model="visible" title="新增预算" width="520px">
      <el-form label-width="90px">
        <el-form-item label="期间"><el-date-picker v-model="form.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  /></el-form-item>
        <el-form-item label="部门ID"><el-input-number v-model="form.deptId" :min="0" /></el-form-item>
        <el-form-item label="科目ID"><el-input-number v-model="form.subjectId" :min="0" /></el-form-item>
        <el-form-item label="预算金额"><el-input v-model="form.budgetAmount" /></el-form-item>
        <el-form-item label="控制策略"><el-select v-model="form.controlRule"><el-option label="预警" value="WARN" /><el-option label="严格控制" value="STRICT" /></el-select></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
