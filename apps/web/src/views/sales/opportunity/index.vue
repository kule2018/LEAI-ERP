<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createOpportunity, fetchOpportunities, updateOpportunity, type Opportunity } from '@/api/sales'

const stages = [
  { label: '初步接触', value: 'PROSPECT' },
  { label: '需求确认', value: 'NEEDS' },
  { label: '方案报价', value: 'PROPOSAL' },
  { label: '商务谈判', value: 'NEGOTIATION' },
  { label: '赢单', value: 'WON' },
  { label: '输单', value: 'LOST' }
]
const rows = ref<Opportunity[]>([])
const loading = ref(false)
const keyword = ref('')
const dialogVisible = ref(false)
const editingId = ref(0)
const form = reactive({ customerId: 0, title: '', expectedAmount: '0', winRate: 10, closeDate: '' })
let requestSeq = 0

const grouped = computed(() => stages.map((stage) => ({
  ...stage,
  items: rows.value.filter((row) => row.stage === stage.value)
})))

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  try {
    const result = await fetchOpportunities({ page: 1, pageSize: 200, keyword: keyword.value })
    if (seq !== requestSeq) return
    rows.value = result.list
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function openAdd(): void {
  editingId.value = 0
  form.customerId = 0
  form.title = ''
  form.expectedAmount = '0'
  form.winRate = 10
  form.closeDate = ''
  dialogVisible.value = true
}

function openEdit(row: unknown): void {
  const opportunity = row as Opportunity
  editingId.value = opportunity.id
  form.customerId = opportunity.customerId
  form.title = opportunity.title
  form.expectedAmount = opportunity.expectedAmount
  form.winRate = opportunity.winRate
  form.closeDate = opportunity.closeDate ?? ''
  dialogVisible.value = true
}

async function save(): Promise<void> {
  try {
    if (editingId.value > 0) {
      await updateOpportunity(editingId.value, {
        title: form.title,
        expectedAmount: form.expectedAmount,
        winRate: form.winRate,
        closeDate: form.closeDate
      })
    } else {
      await createOpportunity({
        customerId: form.customerId,
        title: form.title,
        expectedAmount: form.expectedAmount,
        winRate: form.winRate,
        closeDate: form.closeDate
      })
    }
    dialogVisible.value = false
    ElMessage.success('保存成功')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function advance(row: unknown, stage: string): Promise<void> {
  const opportunity = row as Opportunity
  try {
    await updateOpportunity(opportunity.id, { stage })
    ElMessage.success('阶段已更新')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '更新失败')
  }
}

onMounted(load)
onUnmounted(() => { requestSeq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>商机管道</h2>
      <p>按阶段推进商机，记录预计金额、赢率和预计成交日期。</p>
    </header>
    <div class="toolbar">
      <el-input v-model="keyword" placeholder="搜索商机" clearable @keyup.enter="load" />
      <el-button type="primary" v-perm="'sales:opportunity:create'" @click="openAdd">新增商机</el-button>
      <el-button @click="load">刷新</el-button>
    </div>
    <div v-loading="loading" class="kanban">
      <section v-for="stage in grouped" :key="stage.value" class="kanban-column">
        <header>{{ stage.label }} <span>{{ stage.items.length }}</span></header>
        <el-card v-for="item in stage.items" :key="item.id" shadow="hover" class="opp-card">
          <div class="opp-title">{{ item.title }}</div>
          <div class="opp-meta">客户 {{ item.customerId }} · ¥{{ item.expectedAmount }}</div>
          <el-progress :percentage="item.winRate" />
          <div class="opp-actions">
            <el-button link type="primary" @click="openEdit(item)">编辑</el-button>
            <el-button v-if="stage.value !== 'WON' && stage.value !== 'LOST'" link type="success" @click="advance(item, 'WON')">赢单</el-button>
            <el-button v-if="stage.value !== 'WON' && stage.value !== 'LOST'" link type="danger" @click="advance(item, 'LOST')">输单</el-button>
          </div>
        </el-card>
      </section>
    </div>
    <el-dialog v-model="dialogVisible" title="商机" width="560px">
      <el-form label-width="90px">
        <el-form-item label="客户ID"><el-input-number v-model="form.customerId" :min="1" :disabled="editingId > 0" /></el-form-item>
        <el-form-item label="商机标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="预计金额"><el-input v-model="form.expectedAmount" /></el-form-item>
        <el-form-item label="赢率"><el-input-number v-model="form.winRate" :min="0" :max="100" /></el-form-item>
        <el-form-item label="预计成交"><el-date-picker v-model="form.closeDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.kanban { display: grid; grid-template-columns: repeat(6, minmax(190px, 1fr)); gap: 10px; }
.kanban-column { min-height: 460px; padding: 10px; background: #f0f2f5; border-radius: 8px; }
.kanban-column header { display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: 600; }
.opp-card { margin-bottom: 10px; }
.opp-title { font-weight: 600; }
.opp-meta { margin: 6px 0; color: #646a73; font-size: 12px; }
.opp-actions { display: flex; gap: 4px; margin-top: 8px; }
@media (max-width: 1300px) { .kanban { grid-template-columns: repeat(3, minmax(200px, 1fr)); } }
</style>
