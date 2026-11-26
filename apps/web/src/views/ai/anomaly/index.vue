<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { scanAnomaly, type AiExecution, type AnomalyFinding, type AnomalyResult } from '@/api/ai'

const scope = ref('ALL')
const loading = ref(false)
const execution = ref<AiExecution<AnomalyResult> | null>(null)

async function handleScan(): Promise<void> {
  loading.value = true
  try {
    execution.value = await scanAnomaly({ scope: scope.value })
    ElMessage.success(`扫描完成，发现 ${execution.value.result.count} 项异常`)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '扫描失败')
  } finally {
    loading.value = false
  }
}

function findings(): AnomalyFinding[] {
  return execution.value?.result.findings ?? []
}
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>异常检测</h2>
      <p>扫描库存负可用量、逾期应收、借贷不平凭证与商城同步失败，形成可指派、可关闭的风险清单。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-select v-model="scope" style="width: 180px">
          <el-option label="全部范围" value="ALL" />
          <el-option label="库存" value="INVENTORY" />
          <el-option label="财务" value="FINANCE" />
          <el-option label="商城" value="SHOP" />
        </el-select>
        <el-button type="primary" :loading="loading" v-perm="'ai:anomaly'" @click="handleScan">开始扫描</el-button>
      </div>

      <el-table v-if="execution" :data="findings()" row-key="target" size="small">
        <el-table-column prop="severity" label="级别" width="90" />
        <el-table-column prop="type" label="异常类型" width="170" />
        <el-table-column prop="target" label="对象" min-width="180" />
        <el-table-column prop="message" label="说明" min-width="260" />
        <el-table-column prop="suggestion" label="处理建议" min-width="220" />
      </el-table>
      <el-empty v-else description="尚未执行扫描" />
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
