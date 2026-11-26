<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createPrompt, fetchPrompts, publishPrompt, rollbackPrompt, type AiPrompt } from '@/api/ai'
import type { PageQuery } from '@/types/contract'

const rows = ref<AiPrompt[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const dialogVisible = ref(false)
const form = reactive({ code: '', name: '', content: '', model: 'local-rule-engine', temperature: 0.2 })

let requestSeq = 0

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchPrompts(query.value)
    if (seq !== requestSeq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function isActive(row: unknown): boolean {
  return (row as AiPrompt).isActive === 1
}

async function publish(row: unknown): Promise<void> {
  try {
    await publishPrompt((row as AiPrompt).id)
    ElMessage.success('版本已发布')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '发布失败')
  }
}

async function rollback(row: unknown): Promise<void> {
  try {
    await rollbackPrompt((row as AiPrompt).id)
    ElMessage.success('已回滚到该版本')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '回滚失败')
  }
}

function activeLabel(row: unknown): string {
  return isActive(row) ? '启用' : '停用'
}

function openCreate(): void {
  form.code = ''
  form.name = ''
  form.content = ''
  form.model = 'local-rule-engine'
  form.temperature = 0.2
  dialogVisible.value = true
}

async function handleCreate(): Promise<void> {
  try {
    await createPrompt({ ...form })
    dialogVisible.value = false
    ElMessage.success('Prompt 已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '创建失败')
  }
}

onMounted(load)
onUnmounted(() => {
  requestSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>Prompt 配置</h2>
      <p>按租户维护 Prompt 版本，密钥不明文落库；模型调用统一写入 AI 审计。</p>
    </header>

    <article class="config-panel">
      <div class="panel-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索 Prompt" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'ai:config:create'" @click="openCreate">新增 Prompt</el-button>
        <el-button @click="load">刷新</el-button>
      </div>

      <div v-if="error" class="error-banner">{{ error }}</div>

      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="code" label="编码" width="160" />
        <el-table-column prop="name" label="名称" width="180" />
        <el-table-column prop="content" label="内容" min-width="320" show-overflow-tooltip />
        <el-table-column prop="model" label="模型" width="160" />
        <el-table-column prop="temperature" label="温度" width="90" />
        <el-table-column prop="version" label="版本" width="80" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="isActive(row) ? 'success' : 'info'">{{ activeLabel(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="版本操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'ai:config:update'" :disabled="isActive(row)" @click="publish(row)">发布</el-button>
            <el-button link type="warning" v-perm="'ai:config:update'" :disabled="isActive(row)" @click="rollback(row)">回滚到此版本</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="total"
          :current-page="query.page"
          :page-size="query.pageSize"
          @current-change="(value: number) => { query.page = value; void load() }"
        />
      </div>
    </article>

    <el-dialog v-model="dialogVisible" title="新增 Prompt" width="680px">
      <el-form label-width="90px">
        <el-form-item label="编码"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="8" /></el-form-item>
        <el-form-item label="模型"><el-input v-model="form.model" /></el-form-item>
        <el-form-item label="温度"><el-input-number v-model="form.temperature" :min="0" :max="1" :step="0.1" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.config-panel {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.panel-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.error-banner {
  margin-bottom: 16px;
  padding: 12px 16px;
  color: #f5222d;
  background: #fff1f0;
  border-radius: 8px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
