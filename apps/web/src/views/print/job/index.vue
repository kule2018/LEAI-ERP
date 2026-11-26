<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchPrintJobs, retryPrintJob, type PrintJob } from '@/api/print'
import type { PageQuery } from '@/types/contract'

const jobs = ref<PrintJob[]>([])
const total = ref(0)
const loading = ref(false)
const query = reactive<PageQuery & { status?: string }>({ page: 1, pageSize: 20, status: '' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchPrintJobs({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status ? { status: query.status } : {})
    })
    jobs.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载打印任务失败')
  } finally {
    loading.value = false
  }
}

async function retryById(id: number): Promise<void> {
  try {
    await retryPrintJob(id)
    ElMessage.success(`任务 ${id} 已重新排队`)
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '重试失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>打印任务</h2>
      <p>任务队列保留状态、通道和关联打印记录，失败任务可重新排队。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.status" placeholder="任务状态" clearable @keyup.enter="load" />
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="jobs" row-key="id">
        <el-table-column prop="jobNo" label="任务号" width="180" />
        <el-table-column prop="bizType" label="业务类型" width="130" />
        <el-table-column prop="bizId" label="业务 ID" width="110" />
        <el-table-column prop="channel" label="通道" width="120" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="copies" label="份数" width="80" />
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column prop="finishedAt" label="完成时间" min-width="170" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'print:job:retry'" :disabled="row.status !== 'FAILED'" @click="retryById(Number(row.id))">重试</el-button>
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
</style>
