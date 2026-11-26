<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { fetchDone, type CollabQuery, type FlowTask } from '@/api/collaboration'

const rows = ref<FlowTask[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<CollabQuery>({ page: 1, pageSize: 20 })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchDone(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>已办</h2><p>当前用户已处理的审批任务。</p></header>
    <article class="panel">
      <el-table v-loading="loading" :data="rows" row-key="id" size="small">
        <el-table-column prop="instanceId" label="流程实例" width="120" />
        <el-table-column prop="nodeId" label="节点ID" width="110" />
        <el-table-column prop="status" label="结果" width="120" />
        <el-table-column prop="actedAt" label="处理时间" width="200" />
      </el-table>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
</style>
