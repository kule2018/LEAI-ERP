<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  feedbackKnowledge,
  fetchKnowledgeDocs,
  queryKnowledge,
  upsertKnowledgeDoc,
  type AiExecution,
  type KnowledgeDoc,
  type RagCitation,
  type RagResult
} from '@/api/ai'

const docs = ref<KnowledgeDoc[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const question = ref('')
const execution = ref<AiExecution<RagResult> | null>(null)
const form = reactive({ docCode: '', title: '', content: '', visibility: 'DEPT', docType: 'TEXT', fileUrl: '' })

async function load(): Promise<void> {
  loading.value = true
  try {
    docs.value = await fetchKnowledgeDocs()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载知识库失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, { docCode: '', title: '', content: '', visibility: 'DEPT', docType: 'TEXT', fileUrl: '' })
  dialogVisible.value = true
}

async function upsert(): Promise<void> {
  try {
    await upsertKnowledgeDoc({ ...form })
    dialogVisible.value = false
    ElMessage.success('知识文档已入库')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '入库失败')
  }
}

async function query(): Promise<void> {
  if (!question.value.trim()) return
  try {
    execution.value = await queryKnowledge({ question: question.value, topK: 3 })
    ElMessage.success(`检索到 ${execution.value.result.citations.length} 条引用`)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '查询失败')
  }
}

async function feedback(citation: RagCitation, type: 'GOOD' | 'BAD'): Promise<void> {
  try {
    await feedbackKnowledge(citation.chunkId, type)
    ElMessage.success('反馈已记录')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '反馈失败')
  }
}

function citations(): RagCitation[] {
  return execution.value?.result.citations ?? []
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>企业知识库</h2>
      <p>文档按权限过滤后才能被引用，回答保留文档与片段引用，可对引用结果进行反馈。</p>
    </header>

    <div class="knowledge-layout">
      <article class="panel">
        <div class="panel-toolbar">
          <el-button type="primary" v-perm="'ai:rag'" @click="openCreate">新增文档</el-button>
          <el-button @click="load">刷新</el-button>
        </div>
        <el-table :data="docs" row-key="id" v-loading="loading" size="small">
          <el-table-column prop="docCode" label="编码" width="130" />
          <el-table-column prop="title" label="标题" min-width="160" />
          <el-table-column prop="visibility" label="可见范围" width="100" />
          <el-table-column prop="chunkCount" label="片段数" width="80" />
          <el-table-column prop="status" label="状态" width="90" />
        </el-table>
      </article>

      <article class="panel">
        <h3>知识问答</h3>
        <el-input v-model="question" type="textarea" :rows="3" placeholder="输入问题，例如：销售单如何校验库存？" />
        <el-button type="primary" class="query-button" :loading="loading" v-perm="'ai:rag'" @click="query">检索</el-button>
        <el-empty v-if="!execution" description="尚未检索" />
        <template v-else>
          <el-alert class="answer" :closable="false" type="info" :title="execution.result.answer" />
          <div v-for="item in citations()" :key="item.chunkId" class="citation">
            <div class="citation-head">
              <strong>【{{ item.docTitle }}#{{ item.chunkNo }}】</strong>
              <span>匹配分：{{ item.score }}</span>
            </div>
            <p>{{ item.snippet }}</p>
            <div>
              <el-button link type="primary" @click="feedback(item, 'GOOD')">有帮助</el-button>
              <el-button link type="danger" @click="feedback(item, 'BAD')">无帮助</el-button>
            </div>
          </div>
        </template>
      </article>
    </div>

    <el-dialog v-model="dialogVisible" title="新增知识文档" width="640px">
      <el-form label-width="100px">
        <el-form-item label="文档编码"><el-input v-model="form.docCode" /></el-form-item>
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="可见范围">
          <el-select v-model="form.visibility">
            <el-option label="公开" value="PUBLIC" />
            <el-option label="本部门" value="DEPT" />
            <el-option label="私有" value="PRIVATE" />
          </el-select>
        </el-form-item>
        <el-form-item label="原文件地址"><el-input v-model="form.fileUrl" /></el-form-item>
        <el-form-item label="正文"><el-input v-model="form.content" type="textarea" :rows="8" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="upsert">保存并切分</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.knowledge-layout { display: grid; grid-template-columns: 1.1fr 1fr; gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin-top: 0; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.query-button { margin: 12px 0; }
.answer { margin-bottom: 12px; white-space: pre-wrap; }
.citation { padding: 12px; margin-bottom: 10px; background: #f7f8fa; border-radius: 6px; }
.citation-head { display: flex; justify-content: space-between; font-size: 13px; }
.citation p { margin: 8px 0; line-height: 20px; }
@media (max-width: 1100px) { .knowledge-layout { grid-template-columns: 1fr; } }
</style>
