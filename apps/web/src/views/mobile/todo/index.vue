<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { actFlowTask, fetchTodo, type FlowTask } from '@/api/collaboration'
import type { PageQuery } from '@/types/contract'

const tasks = ref<FlowTask[]>([])
const loading = ref(false)
const query = reactive<PageQuery>({ page: 1, pageSize: 50, keyword: '' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchTodo(query)
    tasks.value = result.list
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载待办失败')
  } finally {
    loading.value = false
  }
}

async function act(id: number, action: 'APPROVE' | 'REJECT'): Promise<void> {
  try {
    await actFlowTask(id, { action, comment: action === 'APPROVE' ? '移动端同意' : '移动端驳回' })
    ElMessage.success(action === 'APPROVE' ? '已同意' : '已驳回')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '审批失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="mobile-page">
    <header class="mobile-header">
      <h2>移动审批</h2>
      <p>待办任务按责任人过滤，审批动作写入流程审计。</p>
    </header>

    <div v-loading="loading">
      <article v-for="task in tasks" :key="task.id" class="mobile-card">
        <div class="card-head">
          <strong>任务 #{{ task.id }}</strong>
          <span class="status">{{ task.status }}</span>
        </div>
        <div class="meta">流程实例：{{ task.instanceId }} ｜ 节点：{{ task.nodeId }}</div>
        <div class="meta">截止：{{ task.dueAt ?? '无' }}</div>
        <div class="actions">
          <el-button size="small" type="primary" v-perm="'flow:todo:approve'" @click="act(Number(task.id), 'APPROVE')">同意</el-button>
          <el-button size="small" type="danger" v-perm="'flow:todo:approve'" @click="act(Number(task.id), 'REJECT')">驳回</el-button>
        </div>
      </article>
      <el-empty v-if="!loading && tasks.length === 0" description="暂无待办" />
    </div>
  </section>
</template>

<style scoped>
.mobile-page { max-width: 560px; margin: 0 auto; }
.mobile-header { margin-bottom: 16px; }
.mobile-header h2 { margin: 0 0 6px; }
.mobile-header p { margin: 0; color: #646a73; font-size: 13px; }
.mobile-card { padding: 16px; margin-bottom: 12px; background: #fff; border-radius: 10px; }
.card-head { display: flex; justify-content: space-between; align-items: center; }
.status { color: #409eff; font-size: 12px; }
.meta { margin-top: 8px; color: #646a73; font-size: 13px; }
.actions { display: flex; gap: 12px; margin-top: 14px; }
.actions .el-button { min-height: 44px; flex: 1; }
</style>
