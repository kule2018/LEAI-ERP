<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { assignRisk, closeRisk, fetchRisks, scanRisks, type RiskAlert, type RiskQuery } from '@/api/risk'

const rows = ref<RiskAlert[]>([])
const total = ref(0)
const loading = ref(false)
const scanning = ref(false)
const query = reactive<RiskQuery>({ page: 1, pageSize: 20, riskType: '', severity: '', status: 'OPEN' })
const expanded = ref<number[]>([])

const severityLabel: Record<string, string> = { HIGH: '高', MEDIUM: '中', LOW: '低' }

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchRisks({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.riskType ? { riskType: query.riskType } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.status ? { status: query.status } : {})
    })
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载风险预警失败')
  } finally {
    loading.value = false
  }
}

async function scan(): Promise<void> {
  scanning.value = true
  try {
    const result = await scanRisks()
    ElMessage.success(`扫描完成：发现 ${result.found}，新增 ${result.created}，重新打开 ${result.reopened}`)
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '扫描失败')
  } finally {
    scanning.value = false
  }
}

async function assign(row: RiskAlert): Promise<void> {
  let input = ''
  try { input = (await ElMessageBox.prompt('请输入责任人用户 ID', '指派风险', { inputPattern: /^\d+$/, inputErrorMessage: '必须是数字用户 ID' })).value ?? '' }
  catch { return }
  try { await assignRisk(row.id, Number(input)); ElMessage.success('已指派'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '指派失败') }
}

function onExpandChange(_row: RiskAlert, expandedRows: RiskAlert[]): void {
  expanded.value = expandedRows.map((item) => item.id)
}

async function close(row: RiskAlert): Promise<void> {
  let input = ''
  try {
    input = (await ElMessageBox.prompt('请输入关闭原因（必填）', '关闭风险', {
      inputType: 'textarea', inputValidator: (v: string) => v.trim().length > 0 || '关闭原因不能为空'
    })).value ?? ''
  } catch { return }
  try { await closeRisk(row.id, input); ElMessage.success('已关闭'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '关闭失败') }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>风险预警中心</h2>
      <p>汇总信用超限、库存不足、应收逾期、审批超时与同步失败；风险可指派、关闭，关闭必须填写原因。</p>
    </header>

    <article class="panel">
      <div class="toolbar">
        <el-select v-model="query.status" clearable placeholder="状态" style="width: 130px" @change="load">
          <el-option label="待处理" value="OPEN" />
          <el-option label="已指派" value="ASSIGNED" />
          <el-option label="已关闭" value="CLOSED" />
        </el-select>
        <el-select v-model="query.severity" clearable placeholder="严重度" style="width: 120px" @change="load">
          <el-option label="高" value="HIGH" />
          <el-option label="中" value="MEDIUM" />
          <el-option label="低" value="LOW" />
        </el-select>
        <el-button type="primary" v-perm="'risk:scan'" :loading="scanning" @click="scan">扫描风险</el-button>
        <el-button @click="load">刷新</el-button>
      </div>

      <el-table :data="rows" row-key="id" v-loading="loading" :expand-row-keys="expanded" @expand-change="onExpandChange">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="detail">
              <p><strong>建议：</strong>{{ row.suggestion || '无' }}</p>
              <p><strong>证据：</strong><code>{{ JSON.stringify(row.evidence) }}</code></p>
              <p v-if="row.closeReason"><strong>关闭原因：</strong>{{ row.closeReason }}</p>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="severity" label="级别" width="80">
          <template #default="{ row }">
            <el-tag :type="row.severity === 'HIGH' ? 'danger' : row.severity === 'MEDIUM' ? 'warning' : 'info'" size="small">
              {{ severityLabel[row.severity] ?? row.severity }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="riskType" label="风险类型" width="180" />
        <el-table-column prop="title" label="标题" min-width="200" />
        <el-table-column prop="message" label="说明" min-width="240" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column prop="assigneeId" label="责任人" width="100" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-if="row.status !== 'CLOSED'" v-perm="'risk:assign'" @click="assign(row)">指派</el-button>
            <el-button link type="danger" v-if="row.status !== 'CLOSED'" v-perm="'risk:close'" @click="close(row)">关闭</el-button>
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
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.detail { padding: 8px 16px; background: #f8f9fb; line-height: 1.7; font-size: 13px; }
.detail code { font-size: 12px; word-break: break-all; }
</style>
