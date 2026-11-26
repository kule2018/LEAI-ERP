<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createTarget, fetchTargets, type SaleTarget } from '@/api/sales'
import type { PageQuery } from '@/types/contract'

const rows = ref<SaleTarget[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const dialogVisible = ref(false)
const form = reactive({ period: '', orgId: 0, userId: 0, targetAmount: '0' })
let requestSeq = 0

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchTargets(query.value)
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
  form.period = new Date().toISOString().slice(0, 7)
  form.orgId = 0
  form.userId = 0
  form.targetAmount = '0'
  dialogVisible.value = true
}

async function save(): Promise<void> {
  try {
    await createTarget({
      period: form.period,
      orgId: form.orgId || undefined,
      userId: form.userId || undefined,
      targetAmount: form.targetAmount
    })
    dialogVisible.value = false
    ElMessage.success('目标已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

function achievement(row: unknown): number {
  const target = row as SaleTarget
  const amount = Number(target.targetAmount)
  return amount > 0 ? Math.round((Number(target.actualAmount) / amount) * 100) : 0
}

onMounted(load)
onUnmounted(() => { requestSeq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>销售目标</h2>
      <p>按期间、组织或人员分解目标，达成率由已审核销售单汇总。</p>
    </header>
    <article class="panel">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索期间" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'sales:target:create'" @click="openAdd">新增目标</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <div v-if="error" class="error">{{ error }}</div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="period" label="期间" width="110" />
        <el-table-column prop="orgId" label="组织ID" width="110" />
        <el-table-column prop="userId" label="人员ID" width="110" />
        <el-table-column prop="targetAmount" label="目标金额" width="140" />
        <el-table-column prop="actualAmount" label="实际金额" width="140" />
        <el-table-column label="达成率" min-width="200">
          <template #default="{ row }"><el-progress :percentage="achievement(row)" /></template>
        </el-table-column>
      </el-table>
    </article>
    <el-dialog v-model="dialogVisible" title="新增销售目标" width="520px">
      <el-form label-width="90px">
        <el-form-item label="期间"><el-date-picker v-model="form.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  /></el-form-item>
        <el-form-item label="组织ID"><el-input-number v-model="form.orgId" :min="0" /></el-form-item>
        <el-form-item label="人员ID"><el-input-number v-model="form.userId" :min="0" /></el-form-item>
        <el-form-item label="目标金额"><el-input v-model="form.targetAmount" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.error { color: #f5222d; margin-bottom: 12px; }
</style>
