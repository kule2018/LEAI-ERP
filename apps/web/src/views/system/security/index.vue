<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  confirmSecurityAlert,
  fetchSecurityAlerts,
  fetchSlowSql,
  fetchSlowSqlHistory,
  materializeSecurityAlerts,
  persistSlowSql,
  type SecurityAlert,
  type SlowSqlAggregate,
  type SlowSqlEntry
} from '@/api/platform-guard'

const tab = ref('alert')
const alerts = ref<SecurityAlert[]>([])
const total = ref(0)
const loading = ref(false)
const query = reactive({ page: 1, pageSize: 20, status: '', level: '' })
const slowEntries = ref<SlowSqlEntry[]>([])
const slowAggregate = ref<SlowSqlAggregate[]>([])
const slowHistory = ref<SlowSqlEntry[]>([])

function fail(cause: unknown): void {
  ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
}

async function loadAlerts(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchSecurityAlerts({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status || undefined,
      level: query.level || undefined
    })
    alerts.value = result.list
    total.value = result.total
  } catch (cause) {
    fail(cause)
  } finally {
    loading.value = false
  }
}

async function handleMaterialize(): Promise<void> {
  try {
    const result = await materializeSecurityAlerts()
    ElMessage.success(`已落库 ${result.count} 条越权告警`)
    await loadAlerts()
  } catch (cause) {
    fail(cause)
  }
}

async function handleConfirm(row: SecurityAlert, status: 'CONFIRMED' | 'CLOSED'): Promise<void> {
  try {
    await confirmSecurityAlert(row.id, { status })
    ElMessage.success(status === 'CONFIRMED' ? '告警已确认' : '告警已关闭')
    await loadAlerts()
  } catch (cause) {
    fail(cause)
  }
}

async function loadSlowSql(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchSlowSql(100)
    slowEntries.value = result.entries
    slowAggregate.value = result.aggregate
    slowHistory.value = await fetchSlowSqlHistory(50)
  } catch (cause) {
    fail(cause)
  } finally {
    loading.value = false
  }
}

async function handlePersist(): Promise<void> {
  try {
    const result = await persistSlowSql()
    ElMessage.success(`已落库 ${result.count} 条慢 SQL`)
    await loadSlowSql()
  } catch (cause) {
    fail(cause)
  }
}

onMounted(() => {
  void loadAlerts()
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>安全与性能</h2>
      <p>越权访问告警来自权限守卫的实时拦截记录；慢 SQL 由数据源查询耗时采集，超阈值语句可批量落库分析。</p>
    </header>

    <el-tabs v-model="tab">
      <el-tab-pane label="越权访问告警" name="alert">
        <div class="toolbar">
          <el-select v-model="query.status" placeholder="状态" clearable style="width: 140px">
            <el-option label="待处理" value="OPEN" />
            <el-option label="已确认" value="CONFIRMED" />
            <el-option label="已关闭" value="CLOSED" />
          </el-select>
          <el-select v-model="query.level" placeholder="级别" clearable style="width: 140px">
            <el-option label="低危" value="LOW" />
            <el-option label="高危" value="HIGH" />
          </el-select>
          <el-button type="primary" @click="loadAlerts">查询</el-button>
          <el-button v-perm="'ops:security:handle'" @click="handleMaterialize">同步队列落库</el-button>
        </div>

        <el-table v-loading="loading" :data="alerts" row-key="id">
          <el-table-column prop="username" label="用户" width="120" />
          <el-table-column prop="perm" label="越权权限码" min-width="180" />
          <el-table-column label="请求" min-width="220">
            <template #default="{ row }">{{ row.method }} {{ row.path }}</template>
          </el-table-column>
          <el-table-column prop="attempts" label="累计次数" width="100" />
          <el-table-column label="级别" width="90">
            <template #default="{ row }">
              <el-tag :type="row.level === 'HIGH' ? 'danger' : 'warning'">{{ row.level === 'HIGH' ? '高危' : '低危' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="reason" label="说明" min-width="220" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="occurredAt" label="发生时间" width="170" />
          <el-table-column label="操作" width="160">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'ops:security:handle'" @click="handleConfirm(row, 'CONFIRMED')">确认</el-button>
              <el-button link v-perm="'ops:security:handle'" @click="handleConfirm(row, 'CLOSED')">关闭</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination">
          <el-pagination
            background
            layout="prev, pager, next"
            :total="total"
            :current-page="query.page"
            :page-size="query.pageSize"
            @current-change="loadAlerts"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="慢 SQL 采集" name="slow">
        <div class="toolbar">
          <el-button type="primary" @click="loadSlowSql">刷新采集</el-button>
          <el-button v-perm="'ops:slowsql:view'" @click="handlePersist">批量落库</el-button>
        </div>

        <h3 class="section-title">按 SQL 聚合（Top 20）</h3>
        <el-table :data="slowAggregate.slice(0, 20)" size="small">
          <el-table-column prop="sql" label="SQL" min-width="420" show-overflow-tooltip />
          <el-table-column prop="count" label="次数" width="90" />
          <el-table-column prop="avgMs" label="平均耗时(ms)" width="130" />
          <el-table-column prop="maxMs" label="最大耗时(ms)" width="130" />
          <el-table-column prop="totalMs" label="总耗时(ms)" width="130" />
        </el-table>

        <h3 class="section-title">实时采集明细</h3>
        <el-table :data="slowEntries" size="small">
          <el-table-column prop="capturedAt" label="采集时间" width="180" />
          <el-table-column prop="durationMs" label="耗时(ms)" width="110" />
          <el-table-column prop="thresholdMs" label="阈值(ms)" width="110" />
          <el-table-column prop="sql" label="SQL" min-width="420" show-overflow-tooltip />
        </el-table>

        <h3 class="section-title">历史落库记录</h3>
        <el-table :data="slowHistory" size="small">
          <el-table-column prop="capturedAt" label="采集时间" width="180" />
          <el-table-column prop="durationMs" label="耗时(ms)" width="110" />
          <el-table-column prop="sql" label="SQL" min-width="420" show-overflow-tooltip />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.section-title {
  margin: 20px 0 12px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
