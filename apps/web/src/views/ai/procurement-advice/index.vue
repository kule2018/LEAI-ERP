<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  addAdviceQuote,
  confirmAdvice,
  fetchAdviceList,
  fetchAdviceMetrics,
  pauseAdvice,
  remindAdvice,
  resumeAdvice,
  startAdvice,
  type AdviceQuote,
  type AdviceTask
} from '@/api/procurement-advice'
import AiFileUpload from '@/components/AiFileUpload.vue'

const tasks = ref<AdviceTask[]>([])
const selectedId = ref<number | null>(null)
const metrics = ref<{ note: string; rows: Array<Record<string, string>> }>({ note: '', rows: [] })

const startForm = reactive({
  productName: '',
  shortageQty: 100,
  suppliers: '供应商甲,供应商乙,供应商丙',
  ruleText: '资质有效、单价不高于预算、交期不超过 15 天'
})

const quoteForm = reactive({
  supplier: '',
  sourceType: 'EXCEL',
  fileName: '',
  unitPrice: 0,
  moq: 1,
  leadTimeDays: 10,
  ruleOk: true,
  evidence: ''
})

const selected = computed(() => tasks.value.find((item) => item.id === selectedId.value) ?? null)
const supplierOptions = computed(() => selected.value?.suppliers?.map((item) => item.name) ?? [])

const statusText: Record<string, string> = {
  WAITING: '等待回复',
  PAUSED: '暂停等待',
  READY: '待人工确认',
  CONFIRMED: '已生成采购草稿',
  REJECTED: '已驳回'
}

async function load(): Promise<void> {
  const result = await fetchAdviceList({ page: 1, pageSize: 50 })
  tasks.value = result.list
  if (!selectedId.value && tasks.value.length > 0) selectedId.value = tasks.value[0].id
  metrics.value = await fetchAdviceMetrics()
}

async function handleStart(): Promise<void> {
  const suppliers = startForm.suppliers.split(/[,，]/).map((item) => item.trim()).filter(Boolean)
  if (!startForm.productName || suppliers.length === 0) {
    ElMessage.warning('请填写缺货产品与供应商')
    return
  }
  const task = await startAdvice({
    productName: startForm.productName,
    shortageQty: Number(startForm.shortageQty),
    suppliers,
    ruleText: startForm.ruleText
  })
  selectedId.value = task.id
  await load()
  ElMessage.success(`已向 ${suppliers.length} 家供应商发出询价`)
}

async function runAction(action: (id: number) => Promise<AdviceTask>, message: string): Promise<void> {
  if (!selectedId.value) return
  await action(selectedId.value)
  await load()
  ElMessage.success(message)
}

async function handleQuote(): Promise<void> {
  if (!selected.value) return
  const supplier = quoteForm.supplier || supplierOptions.value[0]
  if (!supplier) {
    ElMessage.warning('请先选择任务对应的供应商')
    return
  }
  const data: AdviceQuote = {
    supplier,
    sourceType: quoteForm.sourceType,
    fileName: quoteForm.fileName,
    unitPrice: Number(quoteForm.unitPrice),
    moq: Number(quoteForm.moq),
    leadTimeDays: Number(quoteForm.leadTimeDays),
    ruleOk: quoteForm.ruleOk,
    evidence: quoteForm.evidence
  }
  await addAdviceQuote(selected.value.id, data)
  await load()
  ElMessage.success('报价已识别并录入，比价依据已保存')
}

async function handleConfirm(decision: 'CONFIRM' | 'REJECT'): Promise<void> {
  if (!selected.value) return
  await confirmAdvice(selected.value.id, { decision })
  await load()
  ElMessage.success(decision === 'CONFIRM' ? '已生成采购草稿' : '已驳回采购建议')
}

onMounted(load)
</script>

<template>
  <div class="advice-page">
    <div class="page-title">
      <h2>AI 智能询比价</h2>
      <p>从销售缺货到采购建议，让每一步有数据、有依据；AI 负责识别与建议，业务代码负责权限、金额与库存。</p>
    </div>

    <div class="advice-grid">
      <el-card shadow="never" class="panel">
        <template #header><span class="panel-title">01 明确需求与询价</span></template>
        <el-form label-width="90px" size="small">
          <el-form-item label="缺货产品"><el-input v-model="startForm.productName" placeholder="例如：A4 复印纸" /></el-form-item>
          <el-form-item label="缺口数量"><el-input-number v-model="startForm.shortageQty" :min="0.001" :precision="3" /></el-form-item>
          <el-form-item label="供应商"><el-input v-model="startForm.suppliers" placeholder="多个供应商用逗号分隔" /></el-form-item>
          <el-form-item label="采购规则"><el-input v-model="startForm.ruleText" type="textarea" :rows="2" /></el-form-item>
          <el-form-item><el-button type="primary" @click="handleStart">发出询价</el-button></el-form-item>
        </el-form>
        <el-table :data="tasks" size="small" highlight-current-row @current-change="(row: AdviceTask | undefined) => { if (row) selectedId = row.id }">
          <el-table-column prop="taskNo" label="任务号" width="150" />
          <el-table-column prop="productName" label="产品" />
          <el-table-column label="状态" width="130">
            <template #default="{ row }"><el-tag size="small">{{ statusText[row.status] ?? row.status }}</el-tag></template>
          </el-table-column>
        </el-table>
        <div class="button-row">
          <el-button size="small" :disabled="!selected" @click="runAction(pauseAdvice, '任务已暂停，等待供应商回复')">暂停等待</el-button>
          <el-button size="small" :disabled="!selected" @click="runAction(resumeAdvice, '任务已恢复，继续执行')">重启恢复</el-button>
          <el-button size="small" :disabled="!selected" @click="runAction(remindAdvice, '催办提醒已记录')">催办供应商</el-button>
        </div>
        <div class="hint" v-if="selected">
          已催办 {{ selected.remindCount }} 次 · 已恢复 {{ selected.resumeCount }} 次 · 等待时保存进度，重启后继续执行
        </div>
      </el-card>

      <el-card shadow="never" class="panel">
        <template #header><span class="panel-title">02 多模态报价识别与规则比价</span></template>
        <el-form label-width="86px" size="small">
          <el-form-item label="供应商">
            <el-select v-model="quoteForm.supplier" placeholder="选择供应商">
              <el-option v-for="name in supplierOptions" :key="name" :label="name" :value="name" />
            </el-select>
          </el-form-item>
          <el-form-item label="文件类型">
            <el-select v-model="quoteForm.sourceType">
              <el-option label="Excel" value="EXCEL" />
              <el-option label="PDF" value="PDF" />
              <el-option label="截图" value="IMAGE" />
              <el-option label="手工录入" value="MANUAL" />
            </el-select>
          </el-form-item>
          <el-form-item label="文件名">
            <AiFileUpload v-model="quoteForm.fileName" accept=".xlsx,.xls,.pdf,.png,.jpg,.csv" placeholder="上传报价单" />
          </el-form-item>
          <el-form-item label="单价"><el-input-number v-model="quoteForm.unitPrice" :min="0" :precision="2" /></el-form-item>
          <el-form-item label="起订量"><el-input-number v-model="quoteForm.moq" :min="0" /></el-form-item>
          <el-form-item label="交期(天)"><el-input-number v-model="quoteForm.leadTimeDays" :min="0" /></el-form-item>
          <el-form-item label="规则通过"><el-switch v-model="quoteForm.ruleOk" /></el-form-item>
          <el-form-item label="原文依据"><el-input v-model="quoteForm.evidence" placeholder="例如：报价单第 2 行，含税单价" /></el-form-item>
          <el-form-item><el-button type="primary" :disabled="!selected" @click="handleQuote">识别并录入报价</el-button></el-form-item>
        </el-form>
        <el-table :data="selected?.quotes ?? []" size="small" border>
          <el-table-column prop="supplier" label="供应商" width="90" />
          <el-table-column prop="sourceType" label="来源" width="80" />
          <el-table-column prop="unitPrice" label="单价" width="80" />
          <el-table-column prop="leadTimeDays" label="交期" width="70" />
          <el-table-column label="规则">
            <template #default="{ row }"><el-tag :type="row.ruleOk ? 'success' : 'warning'" size="small">{{ row.ruleOk ? '符合' : '待核对' }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="evidence" label="原文依据" show-overflow-tooltip />
        </el-table>
        <div class="rule-citations" v-if="selected?.suggestion">
          <div v-for="rule in selected.suggestion.ruleCitations" :key="rule">规则引用：{{ rule }}</div>
        </div>
      </el-card>

      <el-card shadow="never" class="panel">
        <template #header><span class="panel-title">03 人工确认后接入业务</span></template>
        <template v-if="selected?.suggestion">
          <el-alert type="info" :closable="false" :title="`推荐供应商：${selected.suggestion.winner}`" :description="selected.suggestion.reason" />
          <el-table :data="selected.suggestion.ranking" size="small" border class="mt">
            <el-table-column prop="supplier" label="供应商" />
            <el-table-column prop="score" label="综合得分" width="100" />
            <el-table-column prop="reason" label="判断依据" />
          </el-table>
          <div class="button-row">
            <el-button type="primary" :disabled="selected.status !== 'READY'" @click="handleConfirm('CONFIRM')">人工确认并生成采购草稿</el-button>
            <el-button :disabled="selected.status !== 'READY'" @click="handleConfirm('REJECT')">驳回</el-button>
          </div>
          <div class="draft" v-if="selected.draftNo">采购草稿号：{{ selected.draftNo }}</div>
          <el-steps :active="selected.status === 'CONFIRMED' ? 1 : 0" align-center class="mt">
            <el-step title="采购确认" />
            <el-step title="收货" />
            <el-step title="销售出库" />
          </el-steps>
        </template>
        <el-empty v-else description="报价到齐后生成有依据的采购建议" />
      </el-card>

      <el-card shadow="never" class="panel">
        <template #header><span class="panel-title">04 评测、优化与排查</span></template>
        <el-table :data="metrics.rows" size="small" border>
          <el-table-column prop="scheme" label="方案" width="80" />
          <el-table-column prop="accuracy" label="准确率" width="90" />
          <el-table-column prop="modelCost" label="模型成本" width="110" />
          <el-table-column prop="duration" label="耗时" width="130" />
          <el-table-column prop="remark" label="说明" />
        </el-table>
        <div class="hint">{{ metrics.note }}</div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.advice-page { padding: 16px; }
.page-title h2 { margin: 0 0 4px; font-size: 20px; }
.page-title p { margin: 0 0 16px; color: #606266; font-size: 13px; }
.advice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.panel-title { font-weight: 600; }
.button-row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.hint, .draft, .rule-citations { margin-top: 10px; color: #606266; font-size: 12px; line-height: 1.7; }
.rule-citations div { color: #409eff; }
.mt { margin-top: 12px; }
@media (max-width: 1200px) { .advice-grid { grid-template-columns: 1fr; } }
</style>
