<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  cancelMaterialReturn, createMaterialReturn, fetchDemandSummary, fetchMaterialReturnDetail,
  fetchMaterialReturns, postMaterialReturn, type DemandSummaryRow, type MaterialReturn, type MaterialReturnLine
} from '@/api/mfg-material-return'

const tab = ref('return')
const returns = ref<MaterialReturn[]>([])
const detail = ref<{ order: MaterialReturn; lines: MaterialReturnLine[] } | null>(null)
const detailVisible = computed({
  get: () => detail.value !== null,
  set: (value: boolean) => { if (!value) detail.value = null }
})
const form = reactive({
  workOrderId: undefined as number | undefined,
  warehouseId: undefined as number | undefined,
  reason: '',
  lines: [{ materialId: undefined as number | undefined, qty: '', batchNo: '', remark: '' }]
})
const demandRows = ref<DemandSummaryRow[]>([])
const demandTotals = ref({ totalNetDemand: 0, totalSuggestedQty: 0, runId: null as number | null })

async function load(): Promise<void> {
  const res = await fetchMaterialReturns({ page: 1, pageSize: 50 })
  returns.value = res.list
}

async function loadDemand(): Promise<void> {
  const res = await fetchDemandSummary()
  demandRows.value = res.rows
  demandTotals.value = { totalNetDemand: res.totalNetDemand, totalSuggestedQty: res.totalSuggestedQty, runId: res.runId }
}

async function addLine(): Promise<void> {
  form.lines.push({ materialId: undefined, qty: '', batchNo: '', remark: '' })
}

async function submit(): Promise<void> {
  if (!form.workOrderId || form.lines.some((item) => !item.materialId || !item.qty)) {
    ElMessage.warning('请填写工单 ID 与完整的明细行')
    return
  }
  await createMaterialReturn({
    workOrderId: form.workOrderId,
    warehouseId: form.warehouseId,
    reason: form.reason || undefined,
    lines: form.lines.map((item) => ({
      materialId: item.materialId as number,
      qty: item.qty,
      batchNo: item.batchNo || undefined,
      remark: item.remark || undefined
    }))
  })
  ElMessage.success('退料单已创建')
  await load()
}

async function showDetail(row: MaterialReturn): Promise<void> {
  detail.value = await fetchMaterialReturnDetail(row.id)
}

async function doPost(row: MaterialReturn): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认过账退料单 ${row.returnNo}？物料将回流入库。`, '退料过账', { type: 'warning' })
    await postMaterialReturn(row.id)
    ElMessage.success('退料单已过账')
    await load()
  } catch (cause) {
    if (cause === 'cancel' || cause === 'close') return
    throw cause
  }
}

async function doCancel(row: MaterialReturn): Promise<void> {
  await cancelMaterialReturn(row.id)
  ElMessage.success('退料单已作废')
  await load()
}

onMounted(async () => {
  await Promise.all([load(), loadDemand()])
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>生产退料与需求汇总</h2>
      <p>按工单登记退料单（累计退料量不得超过已领料量），过账后物料回流入库；按产品汇总净需求与建议量。</p>
    </header>
    <el-tabs v-model="tab" type="card">
      <el-tab-pane label="生产退料单" name="return">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="工单 ID"><el-input-number v-model="form.workOrderId" :min="1" /></el-form-item>
            <el-form-item label="入库仓库 ID"><el-input-number v-model="form.warehouseId" :min="1" /></el-form-item>
            <el-form-item label="退料原因"><el-input v-model="form.reason" /></el-form-item>
            <el-form-item label="退料明细">
              <div v-for="(line, index) in form.lines" :key="index" class="line-row">
                <el-input-number v-model="line.materialId" :min="1" placeholder="物料ID" style="width: 150px" />
                <el-input v-model="line.qty" placeholder="数量" style="width: 130px" />
                <el-input v-model="line.batchNo" placeholder="批次" style="width: 130px" />
                <el-button :disabled="form.lines.length === 1" @click="form.lines.splice(index, 1)">删除</el-button>
              </div>
              <el-button @click="addLine">添加明细行</el-button>
            </el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'mfg:return:create'" @click="submit">创建退料单</el-button>
        </article>

        <article class="panel">
          <el-table :data="returns" size="small">
            <el-table-column prop="returnNo" label="退料单号" width="180" />
            <el-table-column prop="workOrderId" label="工单 ID" width="110" />
            <el-table-column prop="totalQty" label="退料数量" width="130" />
            <el-table-column prop="status" label="状态" width="110" />
            <el-table-column prop="reason" label="原因" min-width="180" />
            <el-table-column prop="postedAt" label="过账时间" width="170" />
            <el-table-column label="操作" width="210">
              <template #default="{ row }">
                <el-button size="small" v-perm="'mfg:return:view'" @click="showDetail(row)">明细</el-button>
                <el-button size="small" type="success" :disabled="row.status !== 'DRAFT'" v-perm="'mfg:return:post'" @click="doPost(row)">过账</el-button>
                <el-button size="small" type="danger" :disabled="row.status !== 'DRAFT'" v-perm="'mfg:return:post'" @click="doCancel(row)">作废</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-dialog v-model="detailVisible" title="退料单明细" width="640px">
            <template v-if="detail">
              <el-descriptions :column="3" border size="small">
                <el-descriptions-item label="单号">{{ detail.order.returnNo }}</el-descriptions-item>
                <el-descriptions-item label="工单">{{ detail.order.workOrderId }}</el-descriptions-item>
                <el-descriptions-item label="状态">{{ detail.order.status }}</el-descriptions-item>
              </el-descriptions>
              <el-table :data="detail.lines" size="small" style="margin-top: 12px">
                <el-table-column prop="materialId" label="物料 ID" width="120" />
                <el-table-column prop="qty" label="数量" width="120" />
                <el-table-column prop="batchNo" label="批次" width="150" />
                <el-table-column prop="remark" label="备注" min-width="180" />
              </el-table>
            </template>
          </el-dialog>
        </article>
      </el-tab-pane>

      <el-tab-pane label="需求汇总" name="demand">
        <article class="panel">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="MRP 运行 ID">{{ demandTotals.runId ?? '无（取销售未交量）' }}</el-descriptions-item>
            <el-descriptions-item label="净需求合计">{{ demandTotals.totalNetDemand }}</el-descriptions-item>
            <el-descriptions-item label="建议量合计">{{ demandTotals.totalSuggestedQty }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="demandRows" size="small" style="margin-top: 12px">
            <el-table-column prop="productCode" label="产品编码" width="140" />
            <el-table-column prop="productName" label="产品名称" min-width="180" />
            <el-table-column prop="grossDemand" label="毛需求" width="120" />
            <el-table-column prop="onHand" label="现有库存" width="120" />
            <el-table-column prop="inTransit" label="在途" width="100" />
            <el-table-column prop="netDemand" label="净需求" width="120" />
            <el-table-column prop="suggestedQty" label="建议量" width="120" />
          </el-table>
        </article>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.form-panel { max-width: 860px; }
.line-row { display: flex; gap: 8px; margin-bottom: 8px; }
</style>
