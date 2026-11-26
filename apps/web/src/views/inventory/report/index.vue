<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchAbcReport, fetchAgingReport, fetchInOutReport, fetchInTransitReport,
  fetchInventorySummary, fetchNegativeStock, type InventorySummary, type NegativeStockRow
} from '@/api/inventory'

const summary = ref<InventorySummary | null>(null)
const tab = ref('aging')
const filter = reactive({ warehouseId: undefined as number | undefined, productId: undefined as number | undefined, from: '', to: '' })
const aging = ref<Record<string, unknown> | null>(null)
const abc = ref<Record<string, unknown> | null>(null)
const inOut = ref<Record<string, unknown> | null>(null)
const inTransit = ref<Record<string, unknown> | null>(null)
const negativeStock = ref<NegativeStockRow[]>([])
const negativeSummary = ref<{ totalRows: number; negativeOnHandRows: number; negativeAvailableRows: number; totalShortageQty: number }>({ totalRows: 0, negativeOnHandRows: 0, negativeAvailableRows: 0, totalShortageQty: 0 })
const negativeConfig = ref<{ allowNegativeStock: boolean; permitRequired: boolean }>({ allowNegativeStock: false, permitRequired: true })

async function loadNegative(): Promise<void> {
  const res = await fetchNegativeStock({ page: 1, pageSize: 200, warehouseId: filter.warehouseId, productId: filter.productId })
  negativeStock.value = res.list
  negativeSummary.value = res.summary
  negativeConfig.value = res.config
}

async function loadAll(): Promise<void> {
  const params = { ...filter }
  try {
    aging.value = await fetchAgingReport(params)
    abc.value = await fetchAbcReport(params)
    inOut.value = await fetchInOutReport(params)
    inTransit.value = await fetchInTransitReport(params)
    await loadNegative()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  }
}

onMounted(async () => {
  try { summary.value = await fetchInventorySummary() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
  await loadAll()
})
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>库存报表</h2><p>库存总量、锁定量、冻结量、仓库分布和最近流水。</p></header>
    <div class="kpi-grid">
      <article class="kpi-card"><span>库存总量</span><strong>{{ summary?.totalQty ?? '0.000' }}</strong></article>
      <article class="kpi-card"><span>锁定量</span><strong>{{ summary?.lockedQty ?? '0.000' }}</strong></article>
      <article class="kpi-card"><span>冻结量</span><strong>{{ summary?.frozenQty ?? '0.000' }}</strong></article>
      <article class="kpi-card"><span>流水条数</span><strong>{{ summary?.ledgerCount ?? 0 }}</strong></article>
    </div>
    <div class="report-grid">
      <article class="panel">
        <h3>仓库分布</h3>
        <el-table :data="summary?.byWarehouse ?? []" size="small" row-key="name">
          <el-table-column prop="name" label="仓库" />
          <el-table-column prop="qty" label="库存量" width="140" />
        </el-table>
      </article>
      <article class="panel">
        <h3>产品分布</h3>
        <el-table :data="summary?.byProduct ?? []" size="small" row-key="name">
          <el-table-column prop="name" label="产品" />
          <el-table-column prop="qty" label="库存量" width="140" />
        </el-table>
      </article>
    </div>
    <article class="panel recent">
      <h3>最近流水</h3>
      <el-table :data="summary?.recentLedger ?? []" size="small" row-key="id">
        <el-table-column prop="occurredAt" label="时间" width="180" />
        <el-table-column prop="voucherType" label="类型" width="140" />
        <el-table-column prop="productId" label="产品ID" width="110" />
        <el-table-column prop="qtyIn" label="入库" width="100" />
        <el-table-column prop="qtyOut" label="出库" width="100" />
        <el-table-column prop="balanceQty" label="结存" width="100" />
      </el-table>
    </article>

    <article class="panel recent">
      <h3>库存分析</h3>
      <el-form :inline="true">
        <el-form-item label="仓库 ID"><el-input-number v-model="filter.warehouseId" :min="1" /></el-form-item>
        <el-form-item label="产品 ID"><el-input-number v-model="filter.productId" :min="1" /></el-form-item>
        <el-form-item label="起"><el-date-picker v-model="filter.from" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="止"><el-date-picker v-model="filter.to" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item><el-button type="primary" @click="loadAll">刷新</el-button></el-form-item>
      </el-form>

      <el-tabs v-model="tab">
        <el-tab-pane label="库龄分析" name="aging">
          <el-table :data="(aging?.totals as Array<Record<string, unknown>>) ?? []" size="small">
            <el-table-column prop="label" label="库龄区间" width="140" />
            <el-table-column prop="qty" label="数量" width="140" />
            <el-table-column prop="amount" label="金额" width="160" />
          </el-table>
          <el-table :data="(aging?.rows as Array<Record<string, unknown>>) ?? []" size="small" style="margin-top: 12px">
            <el-table-column prop="productId" label="产品ID" width="110" />
            <el-table-column prop="qty" label="数量" width="120" />
            <el-table-column prop="amount" label="金额" width="140" />
            <el-table-column prop="ageDays" label="库龄天数" width="120" />
            <el-table-column prop="bucket" label="库龄区间" width="140" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="ABC 分类" name="abc">
          <el-table :data="(abc?.rows as Array<Record<string, unknown>>) ?? []" size="small">
            <el-table-column prop="productId" label="产品ID" width="110" />
            <el-table-column prop="qty" label="数量" width="120" />
            <el-table-column prop="amount" label="金额" width="140" />
            <el-table-column prop="ratio" label="金额占比(%)" width="130" />
            <el-table-column prop="cumulative" label="累计占比(%)" width="130" />
            <el-table-column prop="category" label="类别" width="90" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="收发存" name="inout">
          <el-table :data="(inOut?.rows as Array<Record<string, unknown>>) ?? []" size="small">
            <el-table-column prop="productId" label="产品ID" width="110" />
            <el-table-column prop="qtyIn" label="入库" width="130" />
            <el-table-column prop="qtyOut" label="出库" width="130" />
            <el-table-column prop="net" label="净变动" width="130" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="在途量" name="transit">
          <el-table :data="(inTransit?.rows as Array<Record<string, unknown>>) ?? []" size="small">
            <el-table-column prop="productId" label="产品ID" width="110" />
            <el-table-column prop="qty" label="在途数量" width="140" />
            <el-table-column prop="count" label="批次数" width="110" />
            <el-table-column prop="earliestEta" label="最早预计到达" width="150" />
            <el-table-column prop="overdueQty" label="超期数量" width="130" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="负库存清单" name="negative">
          <el-alert
            :type="negativeConfig.allowNegativeStock ? 'success' : 'warning'"
            :closable="false"
            :title="negativeConfig.allowNegativeStock
              ? '系统参数已允许负库存出库（仍需放行权限）'
              : '系统参数未开启负库存出库，超出可用库存的出库将被拒绝'"
            style="margin-bottom: 12px"
          />
          <el-descriptions :column="4" border style="margin-bottom: 12px">
            <el-descriptions-item label="负库存行数">{{ negativeSummary.totalRows }}</el-descriptions-item>
            <el-descriptions-item label="实物量为负">{{ negativeSummary.negativeOnHandRows }}</el-descriptions-item>
            <el-descriptions-item label="可用量为负">{{ negativeSummary.negativeAvailableRows }}</el-descriptions-item>
            <el-descriptions-item label="缺口合计">{{ negativeSummary.totalShortageQty }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="negativeStock" size="small">
            <el-table-column prop="warehouseName" label="仓库" min-width="130" />
            <el-table-column prop="productName" label="产品" min-width="150" />
            <el-table-column prop="batchNo" label="批次" width="120" />
            <el-table-column prop="onHand" label="实物量" width="120" />
            <el-table-column prop="occupied" label="占用量" width="110" />
            <el-table-column prop="frozen" label="冻结量" width="110" />
            <el-table-column prop="availableQty" label="可用量" width="110" />
            <el-table-column prop="shortageQty" label="缺口" width="100" />
            <el-table-column prop="level" label="级别" width="160">
              <template #default="{ row }">
                <el-tag v-if="row.level === 'NEGATIVE_ONHAND'" type="danger">实物量为负</el-tag>
                <el-tag v-else-if="row.level === 'NEGATIVE_AVAILABLE'" type="warning">可用量为负</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </article>
  </section>
</template>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
.kpi-card { padding: 16px; background: #fff; border-radius: 8px; }
.kpi-card span { display: block; margin-bottom: 8px; color: #646a73; }
.kpi-card strong { font-size: 22px; }
.report-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin: 0 0 16px; }
.recent { margin-top: 16px; }
@media (max-width: 1000px) { .kpi-grid, .report-grid { grid-template-columns: 1fr; } }
</style>
