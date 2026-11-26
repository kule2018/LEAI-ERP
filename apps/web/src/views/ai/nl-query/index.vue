<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { runCopilot } from '@/api/ai'

const prompt = ref('查询本月销售额最高的十个客户')
const answer = ref('')
const auditId = ref<number | null>(null)
const loading = ref(false)

async function ask(): Promise<void> {
  if (!prompt.value) {
    ElMessage.warning('请输入要查询的问题')
    return
  }
  loading.value = true
  try {
    const result = await runCopilot(prompt.value)
    answer.value = result.suggestion
    auditId.value = result.auditId
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="nl-page">
    <el-card shadow="never">
      <template #header><span class="title">自然语言查询</span></template>
      <p class="desc">用自然语言查询库存、订单、应收与经营指标；AI 只给建议，写入业务必须另行确认。</p>
      <el-input v-model="prompt" type="textarea" :rows="3" placeholder="例如：查询库存低于安全库存的产品" />
      <div class="actions"><el-button type="primary" :loading="loading" @click="ask">发起查询</el-button></div>
      <el-alert v-if="answer" type="info" :closable="false" title="查询结果" :description="answer" />
      <div v-if="auditId" class="audit">审计任务ID：{{ auditId }}（所有调用留痕，可追溯）</div>
    </el-card>
  </div>
</template>

<style scoped>
.title { font-weight: 600; }
.desc { color: #606266; font-size: 13px; }
.actions { margin: 12px 0; }
.audit { margin-top: 10px; color: #909399; font-size: 12px; }
</style>
