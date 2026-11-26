<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  confirmCopilot,
  csReply,
  matchSubject,
  parseAiFile,
  parseDocument,
  runReconcile,
  runRecommend,
  type AiExecution
} from '@/api/ai'
import AiFileUpload from '@/components/AiFileUpload.vue'

const active = ref('doc')
const loading = ref(false)
const result = ref<AiExecution<Record<string, unknown>> | null>(null)
const applying = ref(false)
const appliedResult = ref<{ bizType: string; bizId: number } | null>(null)
const docForm = reactive({ text: '', targetType: 'SALE_ORDER' })
const fileForm = reactive({ text: '', fileName: '', mimeType: '' })
const recommendForm = reactive({ limit: 5 })
const reconcileForm = reactive({ left: '[]', right: '[]' })
const subjectForm = reactive({ summary: '' })
const csForm = reactive({ question: '', orderNo: '' })

function parseArray(text: string, label: string): Array<Record<string, unknown>> | null {
  try {
    const value: unknown = JSON.parse(text)
    return Array.isArray(value) ? value as Array<Record<string, unknown>> : null
  } catch {
    ElMessage.error(`${label} 不是有效的 JSON 数组`)
    return null
  }
}

function onFileUploaded(_record: unknown, content: string): void {
  if (content) fileForm.text = content
}

async function execute(task: () => Promise<AiExecution<Record<string, unknown>>>): Promise<void> {
  loading.value = true
  appliedResult.value = null
  try {
    result.value = await task()
    ElMessage.success('AI 建议已生成')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '请求失败')
  } finally {
    loading.value = false
  }
}

/** 智能建单草稿人工确认写回：后端二次校验权限与草稿完整性后生成正式单据 */
async function applyDocDraft(): Promise<void> {
  if (!result.value) return
  applying.value = true
  try {
    const confirmed = await confirmCopilot(result.value.auditId, 'YES')
    if (confirmed.appliedBizType && confirmed.appliedBizId) {
      appliedResult.value = { bizType: confirmed.appliedBizType, bizId: confirmed.appliedBizId }
      ElMessage.success(`已确认落库：${confirmed.appliedBizType} #${confirmed.appliedBizId}`)
    } else {
      ElMessage.warning(confirmed.applyError ?? '草稿未生成业务单据')
    }
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '确认失败')
  } finally {
    applying.value = false
  }
}

function parseDoc(): Promise<AiExecution<Record<string, unknown>>> {
  return parseDocument({ text: docForm.text, targetType: docForm.targetType })
}

function parseFile(): Promise<AiExecution<Record<string, unknown>>> {
  return parseAiFile({ ...fileForm })
}

function recommend(): Promise<AiExecution<Record<string, unknown>>> {
  return runRecommend({ limit: recommendForm.limit })
}

async function reconcile(): Promise<void> {
  const left = parseArray(reconcileForm.left, '左侧数据')
  const right = parseArray(reconcileForm.right, '右侧数据')
  if (!left || !right) return
  await execute(() => runReconcile({ left, right }))
}

function match(): Promise<AiExecution<Record<string, unknown>>> {
  return matchSubject({ summary: subjectForm.summary })
}

function reply(): Promise<AiExecution<Record<string, unknown>>> {
  return csReply({ question: csForm.question, orderNo: csForm.orderNo || undefined })
}
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>智能工具</h2>
      <p>智能建单、销售推荐、智能对账、科目匹配和智能客服统一审计；建议需人工确认后才会落库。</p>
    </header>

    <div class="tools-layout">
      <article class="panel">
        <el-tabs v-model="active">
          <el-tab-pane label="智能建单" name="doc">
            <el-form label-width="90px">
              <el-form-item label="目标单据">
                <el-select v-model="docForm.targetType">
                  <el-option label="销售单" value="SALE_ORDER" />
                  <el-option label="采购单" value="PURCHASE_ORDER" />
                </el-select>
              </el-form-item>
              <el-form-item label="文本"><el-input v-model="docForm.text" type="textarea" :rows="9" /></el-form-item>
            </el-form>
            <el-button type="primary" :loading="loading" v-perm="'ai:doc:parse'" @click="execute(parseDoc)">生成草稿</el-button>
          </el-tab-pane>

          <el-tab-pane label="文件解析" name="file">
            <el-form label-width="90px">
              <el-form-item label="文件名">
                <AiFileUpload
                  v-model="fileForm.fileName"
                  v-model:mime-type="fileForm.mimeType"
                  accept=".csv,.txt,.json,.pdf"
                  placeholder="上传报价/订单文件"
                  @uploaded="onFileUploaded"
                />
              </el-form-item>
              <el-form-item label="MIME"><el-input v-model="fileForm.mimeType" readonly placeholder="上传后自动识别" /></el-form-item>
              <el-form-item label="文本"><el-input v-model="fileForm.text" type="textarea" :rows="9" /></el-form-item>
            </el-form>
            <el-button type="primary" :loading="loading" v-perm="'ai:doc:parse'" @click="execute(parseFile)">解析文件</el-button>
          </el-tab-pane>

          <el-tab-pane label="销售推荐" name="recommend">
            <el-form label-width="90px">
              <el-form-item label="推荐数量"><el-input-number v-model="recommendForm.limit" :min="1" :max="20" /></el-form-item>
            </el-form>
            <el-button type="primary" :loading="loading" v-perm="'ai:recommend'" @click="execute(recommend)">生成推荐</el-button>
          </el-tab-pane>

          <el-tab-pane label="智能对账" name="reconcile">
            <el-form label-width="90px">
              <el-form-item label="左侧数据"><el-input v-model="reconcileForm.left" type="textarea" :rows="5" /></el-form-item>
              <el-form-item label="右侧数据"><el-input v-model="reconcileForm.right" type="textarea" :rows="5" /></el-form-item>
            </el-form>
            <el-button type="primary" :loading="loading" v-perm="'ai:reconcile'" @click="reconcile">开始对账</el-button>
          </el-tab-pane>

          <el-tab-pane label="科目匹配" name="subject">
            <el-form label-width="90px">
              <el-form-item label="业务摘要"><el-input v-model="subjectForm.summary" /></el-form-item>
            </el-form>
            <el-button type="primary" :loading="loading" v-perm="'ai:subject.match'" @click="execute(match)">匹配科目</el-button>
          </el-tab-pane>

          <el-tab-pane label="智能客服" name="cs">
            <el-form label-width="90px">
              <el-form-item label="订单号"><el-input v-model="csForm.orderNo" /></el-form-item>
              <el-form-item label="客户问题"><el-input v-model="csForm.question" type="textarea" :rows="5" /></el-form-item>
            </el-form>
            <el-button type="primary" :loading="loading" v-perm="'ai:cs'" @click="execute(reply)">生成话术</el-button>
          </el-tab-pane>
        </el-tabs>
      </article>

      <article class="panel">
        <h3>AI 输出</h3>
        <el-empty v-if="!result" description="尚未生成建议" />
        <template v-else>
          <p class="meta">任务号：{{ result.taskNo }} ｜ 置信度：{{ result.confidence }}</p>
          <pre class="result">{{ JSON.stringify(result.result, null, 2) }}</pre>
          <p v-if="active === 'doc' && result.capability === 'DOC_PARSE'" class="apply-bar">
            <el-button type="primary" :loading="applying" v-perm="'sales:order:create'" @click="applyDocDraft">
              人工确认并生成销售单
            </el-button>
            <span v-if="appliedResult" class="applied">已落库：{{ appliedResult.bizType }} #{{ appliedResult.bizId }}</span>
          </p>
          <p class="warning">AI 不直接写入业务数据，请人工核对后由业务页面确认落库。</p>
        </template>
      </article>
    </div>
  </section>
</template>

<style scoped>
.tools-layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin-top: 0; }
.meta { color: #646a73; font-size: 12px; }
.result { max-height: 480px; padding: 12px; overflow: auto; background: #f7f8fa; border-radius: 6px; font-size: 12px; }
.warning { color: #d46b08; font-size: 12px; }
.apply-bar { display: flex; align-items: center; gap: 12px; margin: 12px 0 0; }
.applied { color: #0a7a3d; font-size: 12px; }
@media (max-width: 1100px) { .tools-layout { grid-template-columns: 1fr; } }
</style>
