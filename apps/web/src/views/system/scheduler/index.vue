<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchSchedulers, runScheduler, tickSchedulers, type SchedulerTask } from '@/api/ops'

const tasks = ref<SchedulerTask[]>([])
const loading = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try { tasks.value = await fetchSchedulers() }
  catch { tasks.value = [] }
  finally { loading.value = false }
}

async function tick(): Promise<void> {
  const result = await tickSchedulers()
  ElMessage.success(`本次调度执行 ${result.executed?.length ?? 0} 个任务`)
  await load()
}

async function run(task: SchedulerTask): Promise<void> {
  await runScheduler(task.code)
  ElMessage.success(`任务 ${task.name} 已触发`)
  await load()
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>定时任务</h2>
      <p>查看系统已注册的定时任务，手动触发或按到期规则轮询执行。</p>
    </header>
    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'system:monitor:update'" @click="tick">执行到期轮询</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table :data="tasks" v-loading="loading" size="small">
        <el-table-column prop="code" label="任务编码" width="180" />
        <el-table-column prop="name" label="任务名称" min-width="180" />
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="intervalMinutes" label="间隔(分钟)" width="120" />
        <el-table-column prop="lastRunAt" label="上次执行" width="180" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'system:monitor:update'" @click="run(row)">立即执行</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
