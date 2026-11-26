<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { drillAiReport, exportAiReport, reportInsight, type AiExecution } from '@/api/ai'

const loading = ref(false)
const execution = ref<AiExecution<Record<string, unknown>> | null>(null)
const drillRows = ref<Array<Record<string, unknown>>>([])
const metrics = reactive({ reportType: 'OPERATION', revenue: '0', previousRevenue: '0', cost: '0', overdueAmount: '0' })

async function handleRun(): Promise<void> {
  loading.value = true
  try {
    execution.value = await reportInsight({
      reportType: metrics.reportType,
      metrics: {
        revenue: metrics.revenue,
        previousRevenue: metrics.previousRevenue,
        cost: metrics.cost,
        overdueAmount: metrics.overdueAmount
      }
    })
    ElMessage.success('报表解读已生成')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '解读失败')
  } finally {
    loading.value = false
  }
}

function diagnoses(): string[] {
  const value = execution.value?.result.diagnoses
  return Array.isArray(value) ? value.map(String) : []
}

function metricValues(): Record<string, unknown> {
  return {
    revenue: Number(metrics.revenue),
    previousRevenue: Number(metrics.previousRevenue),
    cost: Number(metrics.cost),
    overdueAmount: Number(metrics.overdueAmount)
  }
}

async function handleExport(): Promise<void> {
  try {
    const result = await exportAiReport({
      metrics: metricValues(),
      diagnoses: diagnoses(),
      citations: (execution.value?.result.citations ?? []) as Array<Record<string, unknown>>
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([result.content], { type: 'text/csv;charset=utf-8' }))
    link.download = result.filename
    link.click()
    URL.revokeObjectURL(link.href)
    ElMessage.success('报表快照已导出')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '导出失败')
  }
}

async function handleDrill(): Promise<void> {
  try {
    drillRows.value = await drillAiReport(metricValues(), metrics.reportType)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '下钻失败')
  }
}
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>报表解读</h2>
      <p>输入指标快照后生成经营诊断与引用来源，结论可追溯且不会直接修改业务数据。</p>
    </header>

    <div class="report-layout">
      <article class="panel">
        <h3>指标快照</h3>
        <el-form label-width="110px">
          <el-form-item label="报表类型"><el-input v-model="metrics.reportType" /></el-form-item>
          <el-form-item label="本期收入"><el-input v-model="metrics.revenue" /></el-form-item>
          <el-form-item label="上期收入"><el-input v-model="metrics.previousRevenue" /></el-form-item>
          <el-form-item label="成本"><el-input v-model="metrics.cost" /></el-form-item>
          <el-form-item label="逾期金额"><el-input v-model="metrics.overdueAmount" /></el-form-item>
        </el-form>
        <el-button type="primary" :loading="loading" v-perm="'ai:report'" @click="handleRun">生成解读</el-button>
        <el-button v-perm="'ai:report'" @click="handleExport">导出快照</el-button>
        <el-button v-perm="'ai:report'" @click="handleDrill">归因下钻</el-button>
      </article>

      <article class="panel">
        <h3>诊断结论</h3>
        <el-empty v-if="!execution" description="尚未生成解读" />
        <template v-else>
          <p>审计 ID：{{ execution.auditId }} ｜ 置信度：{{ execution.confidence }}</p>
          <el-timeline>
            <el-timeline-item v-for="(item, index) in diagnoses()" :key="index">{{ item }}</el-timeline-item>
          </el-timeline>
          <pre class="citations">{{ JSON.stringify(execution.result.citations, null, 2) }}</pre>
        </template>
        <el-table :data="drillRows" size="small" style="margin-top: 16px">
          <el-table-column prop="name" label="归因项" />
          <el-table-column prop="value" label="金额" />
          <el-table-column prop="ratio" label="占比" />
        </el-table>
      </article>
    </div>
  </section>
</template>

<style scoped>
.report-layout { display: grid; grid-template-columns: 380px 1fr; gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin-top: 0; }
.citations { max-height: 320px; padding: 12px; overflow: auto; background: #f7f8fa; border-radius: 6px; font-size: 12px; }
@media (max-width: 1100px) { .report-layout { grid-template-columns: 1fr; } }
</style>
