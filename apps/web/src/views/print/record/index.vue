<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchPrintRecords, type PrintRecord } from '@/api/print'
import type { PageQuery } from '@/types/contract'

const records = ref<PrintRecord[]>([])
const total = ref(0)
const loading = ref(false)
const query = reactive<PageQuery & { bizType?: string }>({ page: 1, pageSize: 20, bizType: '' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchPrintRecords({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.bizType ? { bizType: query.bizType, keyword: query.bizType } : {})
    })
    records.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载打印记录失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>打印记录</h2>
      <p>每次打印均记录模板版本、份数、水印与打印人，供补打审计追溯。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.bizType" placeholder="业务类型或单号" clearable @keyup.enter="load" />
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="records" row-key="id">
        <el-table-column prop="templateCode" label="模板" width="150" />
        <el-table-column prop="bizType" label="业务类型" width="130" />
        <el-table-column prop="bizNo" label="业务单号" min-width="150" />
        <el-table-column prop="copies" label="份数" width="80" />
        <el-table-column prop="channel" label="通道" width="120" />
        <el-table-column prop="printedBy" label="打印人" width="100" />
        <el-table-column prop="printedAt" label="打印时间" min-width="170" />
        <el-table-column prop="watermark" label="水印" min-width="220" />
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
