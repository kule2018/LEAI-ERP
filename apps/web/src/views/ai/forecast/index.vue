<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  confirmForecastSuggestion,
  fetchForecastSuggestions,
  runForecast,
  type AiExecution,
  type ForecastResult,
  type ForecastSuggestion
} from '@/api/ai'

const productId = ref(0)
const periods = ref(3)
const availableQty = ref(0)
const safetyStock = ref(0)
const leadTimeDays = ref(30)
const minOrderQty = ref(0)
const lotSize = ref(0)
const loading = ref(false)
const execution = ref<AiExecution<ForecastResult> | null>(null)

const suggestions = ref<ForecastSuggestion[]>([])
const suggestionTotal = ref(0)
const suggestionPage = ref(1)
const suggestionPageSize = ref(10)
const suggestionStatus = ref('')
const listLoading = ref(false)
const actingId = ref<number | null>(null)

async function handleRun(): Promise<void> {
  loading.value = true
  try {
    execution.value = await runForecast({
      productId: productId.value || undefined,
      periods: periods.value,
      availableQty: availableQty.value,
      safetyStock: safetyStock.value,
      leadTimeDays: leadTimeDays.value,
      minOrderQty: minOrderQty.value,
      lotSize: lotSize.value
    })
    ElMessage.success('销量预测已完成，补货建议已生成待确认记录')
    await loadSuggestions()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '预测失败')
  } finally {
    loading.value = false
  }
}

async function loadSuggestions(): Promise<void> {
  listLoading.value = true
  try {
    const result = await fetchForecastSuggestions({
      page: suggestionPage.value,
      pageSize: suggestionPageSize.value,
      status: suggestionStatus.value || undefined
    })
    suggestions.value = result.list ?? result.items ?? []
    suggestionTotal.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载补货建议失败')
  } finally {
    listLoading.value = false
  }
}

function levelTag(level: string): 'success' | 'warning' | 'danger' | 'info' {
  if (level === 'URGENT') return 'danger'
  if (level === 'HIGH') return 'warning'
  if (level === 'LOW') return 'info'
  return 'success'
}

async function handleConfirm(row: ForecastSuggestion): Promise<void> {
  const qtyInput = await ElMessageBox.prompt(
    `确认后将按采购需求写回（产品 #${row.productId}），可调整补货量。`,
    '确认补货建议',
    {
      inputValue: row.suggestQty,
      inputPattern: /^\d+(\.\d{1,3})?$/,
      inputErrorMessage: '请输入大于 0 的数量'
    }
  ).catch(() => null)
  if (!qtyInput) return
  actingId.value = row.id
  try {
    const result = await confirmForecastSuggestion(row.id, { accepted: 'YES', qty: Number(qtyInput.value) })
    ElMessage.success(`已确认并生成采购需求 ${result.demand?.demandNo ?? ''}`)
    await loadSuggestions()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '确认失败')
  } finally {
    actingId.value = null
  }
}

async function handleReject(row: ForecastSuggestion): Promise<void> {
  const reason = await ElMessageBox.prompt('请填写拒绝原因，将记录到建议与审计日志。', '拒绝补货建议', {
    inputPattern: /^.{2,}$/,
    inputErrorMessage: '原因至少 2 个字符'
  }).catch(() => null)
  if (!reason) return
  actingId.value = row.id
  try {
    await confirmForecastSuggestion(row.id, { accepted: 'NO', reason: reason.value })
    ElMessage.success('已拒绝该补货建议')
    await loadSuggestions()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
  } finally {
    actingId.value = null
  }
}

onMounted(loadSuggestions)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>销量预测</h2>
      <p>基于近 6 个月销售明细计算移动平均与补货建议；建议必须人工确认后才会写回采购需求。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input-number v-model="productId" :min="0" placeholder="产品 ID（0 为全部）" />
        <el-input-number v-model="periods" :min="1" :max="12" />
        <el-input-number v-model="availableQty" :min="0" :precision="3" placeholder="可用量" />
        <el-input-number v-model="safetyStock" :min="0" :precision="3" placeholder="安全库存" />
        <el-input-number v-model="leadTimeDays" :min="0" :max="365" placeholder="提前期（天）" />
        <el-input-number v-model="minOrderQty" :min="0" :precision="3" placeholder="最小起订量" />
        <el-input-number v-model="lotSize" :min="0" :precision="3" placeholder="批量倍数" />
        <el-button type="primary" :loading="loading" v-perm="'ai:forecast'" @click="handleRun">运行预测</el-button>
      </div>

      <el-empty v-if="!execution" description="尚未生成预测" />
      <template v-else>
        <div class="metric-grid">
          <article class="metric-card"><span>模型</span><strong>{{ execution.result.model }}</strong></article>
          <article class="metric-card"><span>月均销量</span><strong>{{ execution.result.avgQty }}</strong></article>
          <article class="metric-card"><span>补货建议</span><strong>{{ execution.result.suggestedQty }}</strong></article>
          <article class="metric-card">
            <span>历史准确率</span>
            <strong>{{ execution.result.accuracy ? `${(execution.result.accuracy.accuracy * 100).toFixed(1)}%` : 'N/A' }}</strong>
          </article>
        </div>
        <div v-if="execution.result.suggestion" class="suggestion-box">
          <el-tag :type="levelTag(execution.result.suggestion.level)" size="small">
            {{ execution.result.suggestion.level }}
          </el-tag>
          <span class="suggestion-text">{{ execution.result.suggestion.reason }}</span>
          <span class="suggestion-meta">
            可覆盖 {{ execution.result.suggestion.coverDays }} 天 ·
            置信度 {{ (execution.result.suggestion.confidence * 100).toFixed(0) }}% ·
            净需求 {{ execution.result.suggestion.netQty }}
          </span>
        </div>
        <el-table :data="execution.result.forecast" row-key="period" size="small">
          <el-table-column prop="period" label="预测期间" />
          <el-table-column prop="qty" label="预测销量" />
        </el-table>
        <el-alert class="note" :closable="false" type="warning" :title="execution.result.note" />
      </template>
    </article>

    <article class="panel">
      <div class="panel-toolbar">
        <h3 class="sub-title">补货建议确认队列</h3>
        <el-select v-model="suggestionStatus" clearable placeholder="全部状态" style="width: 140px" @change="loadSuggestions">
          <el-option label="待确认" value="PENDING" />
          <el-option label="已确认" value="CONFIRMED" />
          <el-option label="已拒绝" value="REJECTED" />
        </el-select>
        <el-button :loading="listLoading" @click="loadSuggestions">刷新</el-button>
      </div>
      <el-table :data="suggestions" size="small" v-loading="listLoading">
        <el-table-column prop="id" label="#" width="70" />
        <el-table-column prop="productId" label="产品" width="90" />
        <el-table-column label="建议量" width="110">
          <template #default="{ row }">{{ row.suggestQty }}</template>
        </el-table-column>
        <el-table-column label="可用覆盖(天)" width="120">
          <template #default="{ row }">{{ row.coverDays }}</template>
        </el-table-column>
        <el-table-column label="紧急度" width="100">
          <template #default="{ row }">
            <el-tag :type="levelTag(row.level)" size="small">{{ row.level }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="置信度" width="100">
          <template #default="{ row }">{{ (Number(row.confidence) * 100).toFixed(0) }}%</template>
        </el-table-column>
        <el-table-column label="准确率" width="100">
          <template #default="{ row }">{{ (Number(row.accuracy) * 100).toFixed(0) }}%</template>
        </el-table-column>
        <el-table-column prop="reason" label="建议说明" min-width="220" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="warning" size="small">待确认</el-tag>
            <el-tag v-else-if="row.status === 'CONFIRMED'" type="success" size="small">已确认</el-tag>
            <el-tag v-else type="info" size="small">已拒绝</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'PENDING'">
              <el-button link type="primary" :loading="actingId === row.id" @click="handleConfirm(row)">确认</el-button>
              <el-button link type="danger" :loading="actingId === row.id" @click="handleReject(row)">拒绝</el-button>
            </template>
            <span v-else class="muted">{{ row.appliedBizType === 'purchase_demand' ? `需求 #${row.appliedBizId}` : (row.rejectReason ?? '') }}</span>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="pager"
        layout="total, prev, pager, next"
        :total="suggestionTotal"
        :page-size="suggestionPageSize"
        :current-page="suggestionPage"
        @current-change="(value: number) => { suggestionPage = value; loadSuggestions() }"
      />
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.panel-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; align-items: center; }
.sub-title { margin: 0; font-size: 15px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.metric-card { padding: 12px; background: #f7f8fa; border-radius: 6px; }
.metric-card span { display: block; color: #646a73; font-size: 12px; }
.metric-card strong { display: block; margin-top: 6px; font-size: 18px; }
.suggestion-box { display: flex; align-items: center; gap: 10px; padding: 10px 12px; margin-bottom: 12px; background: #f4f7fd; border-radius: 6px; }
.suggestion-text { flex: 1; }
.suggestion-meta { color: #646a73; font-size: 12px; }
.note { margin-top: 16px; }
.pager { margin-top: 12px; }
.muted { color: #8f959e; font-size: 12px; }
</style>
