<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchInventoryMovement, fetchSubjects,
  type InventoryMovementResult, type Subject
} from '@/api/finance'

const period = ref(new Date().toISOString().slice(0, 7))
const subjectId = ref<number | undefined>(undefined)
const subjects = ref<Subject[]>([])
const result = ref<InventoryMovementResult | null>(null)
const loading = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    result.value = await fetchInventoryMovement({ period: period.value, subjectId: subjectId.value })
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '存货收发存查询失败')
  } finally { loading.value = false }
}
async function loadSubjects(): Promise<void> {
  try {
    const list = await fetchSubjects({ page: 1, pageSize: 300, keyword: '' })
    subjects.value = list.list.filter((item) => item.category === 'ASSET')
  } catch { subjects.value = [] }
}
onMounted(async () => { await loadSubjects(); await load() })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>存货收发存</h2><p>按移动加权口径统计期初结存、本期出入库与期末结存，并与存货科目余额对账。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-date-picker v-model="period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM" style="width: 160px"  />
        <el-select v-model="subjectId" clearable filterable placeholder="存货科目（用于对账）" style="width: 260px">
          <el-option v-for="item in subjects" :key="item.id" :label="`${item.subjectCode} ${item.subjectName}`" :value="item.id" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
      </div>
      <el-alert
        v-if="result && result.subjectId"
        :type="result.reconciled ? 'success' : 'warning'"
        :closable="false"
        show-icon
        :title="result.reconciled ? '存货收发存与存货科目余额一致' : `与存货科目余额差异：${result.difference ?? 0}`"
        style="margin-bottom: 12px"
      />
      <el-table v-loading="loading" :data="result?.rows ?? []" row-key="productId">
        <el-table-column prop="productName" label="产品" min-width="200" />
        <el-table-column prop="openingQty" label="期初数量" width="110" />
        <el-table-column prop="openingAmount" label="期初金额" width="130" />
        <el-table-column prop="openingAvgCost" label="期初均价" width="120" />
        <el-table-column prop="inQty" label="入库数量" width="110" />
        <el-table-column prop="inAmount" label="入库金额" width="130" />
        <el-table-column prop="outQty" label="出库数量" width="110" />
        <el-table-column prop="outAmount" label="出库金额" width="130" />
        <el-table-column prop="closingQty" label="期末数量" width="110" />
        <el-table-column prop="closingAmount" label="期末金额" width="130" />
        <el-table-column prop="closingAvgCost" label="期末均价" width="120" />
      </el-table>
      <el-descriptions v-if="result" :column="4" border style="margin-top: 16px">
        <el-descriptions-item label="期初金额">{{ result.totals.openingAmount }}</el-descriptions-item>
        <el-descriptions-item label="入库金额">{{ result.totals.inAmount }}</el-descriptions-item>
        <el-descriptions-item label="出库金额">{{ result.totals.outAmount }}</el-descriptions-item>
        <el-descriptions-item label="期末金额">{{ result.totals.closingAmount }}</el-descriptions-item>
      </el-descriptions>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
