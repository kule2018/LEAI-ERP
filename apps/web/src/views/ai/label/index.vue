<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { recognizeLabel, type AiExecution } from '@/api/ai'
import AiFileUpload from '@/components/AiFileUpload.vue'

const text = ref('')
const fileName = ref('')
const loading = ref(false)
const execution = ref<AiExecution<Record<string, unknown>> | null>(null)

function onFileUploaded(_record: unknown, content: string): void {
  if (content) text.value = content
}

async function handleRecognize(): Promise<void> {
  loading.value = true
  try {
    execution.value = await recognizeLabel({ text: text.value, fileName: fileName.value || undefined })
    ElMessage.success('标签识别完成')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '识别失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>标签识别</h2>
      <p>从产品图片名称或描述中提取品名、分类、规格与条码，确认后才能用于商品档案。</p>
    </header>

    <div class="label-layout">
      <article class="panel">
        <el-form label-width="90px">
          <el-form-item label="文件名">
            <AiFileUpload v-model="fileName" accept=".jpg,.jpeg,.png,.txt" placeholder="上传标签图片" @uploaded="onFileUploaded" />
          </el-form-item>
          <el-form-item label="识别文本"><el-input v-model="text" type="textarea" :rows="12" placeholder="品名：无线耳机&#10;电子 规格：黑色 128G&#10;条码：6901234567892" /></el-form-item>
        </el-form>
        <el-button type="primary" :loading="loading" v-perm="'ai:label'" @click="handleRecognize">识别标签</el-button>
      </article>
      <article class="panel">
        <h3>识别结果</h3>
        <pre v-if="execution" class="result">{{ JSON.stringify(execution.result, null, 2) }}</pre>
        <el-empty v-else description="尚未识别" />
      </article>
    </div>
  </section>
</template>

<style scoped>
.label-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin-top: 0; }
.result { max-height: 420px; padding: 12px; overflow: auto; background: #f7f8fa; border-radius: 6px; font-size: 13px; }
@media (max-width: 1100px) { .label-layout { grid-template-columns: 1fr; } }
</style>
