<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchAiTasks, type AiTask, type AiTaskQuery } from '@/api/ai'

const tasks = ref<AiTask[]>([])
const total = ref(0)
const loading = ref(false)
const query = reactive<AiTaskQuery>({ page: 1, pageSize: 20, capability: '', status: '' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchAiTasks({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.capability ? { capability: query.capability } : {}),
      ...(query.status ? { status: query.status } : {})
    })
    tasks.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载 AI 任务失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>AI 审计任务</h2>
      <p>所有 AI 能力调用均生成任务与审计记录，包含输入、结果、置信度与证据链。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.capability" placeholder="能力码" clearable @keyup.enter="load" />
        <el-input v-model="query.status" placeholder="状态" clearable @keyup.enter="load" />
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table :data="tasks" row-key="id" v-loading="loading">
        <el-table-column prop="taskNo" label="任务号" width="180" />
        <el-table-column prop="capability" label="能力码" width="150" />
        <el-table-column prop="confidence" label="置信度" width="100" />
        <el-table-column prop="status" label="状态" width="90" />
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column type="expand">
          <template #default="{ row }">
            <pre class="json">{{ JSON.stringify(row.resultJson, null, 2) }}</pre>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.json { max-height: 260px; padding: 12px; overflow: auto; background: #f7f8fa; border-radius: 6px; font-size: 12px; }
</style>
