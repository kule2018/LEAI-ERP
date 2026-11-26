<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { rerecognizeOcr, runOcr, type AiExecution, type OcrField, type OcrResult } from '@/api/ai'
import AiFileUpload from '@/components/AiFileUpload.vue'

const text = ref('')
const fileName = ref('')
const fileUrl = ref('')
const docType = ref('')
const loading = ref(false)
const execution = ref<AiExecution<OcrResult> | null>(null)
const corrections = reactive<Record<string, string>>({})

async function handleRun(): Promise<void> {
  if (!text.value.trim()) {
    ElMessage.warning('请粘贴票据文本或使用本地规则引擎可识别的内容')
    return
  }
  loading.value = true
  try {
    execution.value = await runOcr({
      text: text.value,
      fileName: fileName.value || undefined,
      fileUrl: fileUrl.value || undefined,
      docType: docType.value || undefined
    })
    Object.keys(corrections).forEach((key) => delete corrections[key])
    fields().forEach((field) => { corrections[field.key] = field.value ?? '' })
    ElMessage.success(`识别完成，置信度 ${execution.value.confidence}`)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '识别失败')
  } finally {
    loading.value = false
  }
}

function fields(): OcrField[] {
  return execution.value?.result.fields ?? []
}

function onFileUploaded(_record: unknown, content: string): void {
  if (content) text.value = content
}

async function handleRerecognize(): Promise<void> {
  if (!execution.value) return
  loading.value = true
  try {
    const changed = Object.fromEntries(
      Object.entries(corrections).filter(([key, value]) =>
        fields().some((field) => field.key === key && field.value !== value))
    )
    execution.value = await rerecognizeOcr(execution.value.taskId, changed)
    ElMessage.success('OCR 重识别已完成')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '重识别失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>OCR 识别</h2>
      <p>发票、证照与单据结构化识别；无外部模型时使用规则引擎兜底，低置信字段必须人工复核。</p>
    </header>

    <div class="ocr-layout">
      <article class="panel">
        <h3>识别输入</h3>
        <el-form label-width="90px">
          <el-form-item label="文件名">
            <AiFileUpload
              v-model="fileName"
              v-model:file-url="fileUrl"
              accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
              placeholder="上传发票/证照"
              @uploaded="onFileUploaded"
            />
          </el-form-item>
          <el-form-item label="单据类型">
            <el-select v-model="docType" clearable placeholder="自动识别">
              <el-option label="发票" value="INVOICE" />
              <el-option label="营业执照" value="LICENSE" />
              <el-option label="通用单据" value="DOCUMENT" />
            </el-select>
          </el-form-item>
          <el-form-item label="文本内容">
            <el-input v-model="text" type="textarea" :rows="12" placeholder="发票号码：12345678&#10;开票日期：2026-11-20&#10;价税合计：￥1234.56" />
          </el-form-item>
        </el-form>
        <el-button type="primary" :loading="loading" v-perm="'ai:ocr'" @click="handleRun">开始识别</el-button>
      </article>

      <article class="panel">
        <h3>结构化结果</h3>
        <el-empty v-if="!execution" description="尚未执行识别" />
        <template v-else>
          <p class="meta">任务号：{{ execution.taskNo }} ｜ 审计 ID：{{ execution.auditId }}</p>
          <el-table :data="fields()" row-key="key" size="small">
            <el-table-column prop="label" label="字段" width="110" />
            <el-table-column prop="value" label="识别值" min-width="180" />
            <el-table-column prop="confidence" label="置信度" width="100" />
            <el-table-column label="人工修正" min-width="180">
              <template #default="{ row }"><el-input v-model="corrections[row.key]" size="small" /></template>
            </el-table-column>
          </el-table>
          <p class="review">待复核字段：{{ execution.result.needsReview.join('、') || '无' }}</p>
          <el-button v-perm="'ai:ocr'" :loading="loading" @click="handleRerecognize">按修正值重识别</el-button>
        </template>
      </article>
    </div>
  </section>
</template>

<style scoped>
.ocr-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin-top: 0; }
.meta { color: #646a73; font-size: 12px; }
.review { margin-top: 12px; color: #d46b08; }
@media (max-width: 1100px) { .ocr-layout { grid-template-columns: 1fr; } }
</style>
