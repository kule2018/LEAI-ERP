<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createCollectionPlan, fetchAgingRisk, fetchCollectionPlans, type CollectionPlan
} from '@/api/finance-extension'

const plans = ref<CollectionPlan[]>([])
const risk = ref<Record<string, unknown> | null>(null)
const form = reactive({ customerId: undefined as number | undefined, planDate: '', amount: '', note: '' })

async function load(): Promise<void> {
  const result = await fetchCollectionPlans({ page: 1, pageSize: 50 })
  plans.value = result.list
}

async function scan(): Promise<void> {
  risk.value = await fetchAgingRisk({})
}

async function submit(): Promise<void> {
  if (!form.customerId) {
    ElMessage.warning('请填写客户 ID')
    return
  }
  await createCollectionPlan({
    customerId: form.customerId,
    planDate: form.planDate || undefined,
    targetAmount: form.amount || undefined,
    note: form.note || undefined
  })
  ElMessage.success('催收计划已创建')
  await load()
}

onMounted(async () => { await load(); await scan() })
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>收账台</h2>
      <p>集中查看逾期账款与催收计划，登记跟进任务。</p>
    </header>
    <article v-if="risk" class="panel">
      <el-descriptions :column="4" border>
        <el-descriptions-item v-for="(value, key) in risk" :key="String(key)" :label="String(key)">
          {{ Array.isArray(value) ? `${value.length} 条` : typeof value === 'object' ? JSON.stringify(value).slice(0, 80) : String(value) }}
        </el-descriptions-item>
      </el-descriptions>
    </article>
    <article class="panel form-panel">
      <el-form :inline="true">
        <el-form-item label="客户ID"><el-input-number v-model="form.customerId" :min="1" /></el-form-item>
        <el-form-item label="计划日期"><el-date-picker v-model="form.planDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="目标金额"><el-input v-model="form.amount" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.note" /></el-form-item>
        <el-form-item><el-button type="primary" v-perm="'finance:collection:plan'" @click="submit">登记催收</el-button></el-form-item>
      </el-form>
    </article>
    <article class="panel">
      <el-table :data="plans" size="small">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="customerId" label="客户ID" width="110" />
        <el-table-column prop="planDate" label="计划日期" width="130" />
        <el-table-column prop="targetAmount" label="目标金额" width="140" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="note" label="备注" min-width="200" />
      </el-table>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.form-panel { max-width: 1000px; }
</style>
