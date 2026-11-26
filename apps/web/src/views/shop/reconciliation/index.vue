<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchReconcileBills, importReconcileBills, resolveReconcileBill, type ReconcileBill
} from '@/api/shop'
import type { PageQuery } from '@/types/contract'

const bills = ref<ReconcileBill[]>([])
const total = ref(0)
const loading = ref(false)
const importVisible = ref(false)
const resolveVisible = ref(false)
const currentBillId = ref(0)
const query = reactive<PageQuery & { status?: string }>({ page: 1, pageSize: 20, status: '' })
const form = reactive({
  storeId: 0,
  billNo: '',
  channel: 'WECHAT',
  period: '',
  platformAmount: '0',
  localAmount: '0',
  currency: 'CNY'
})
const resolveForm = reactive({ note: '' })

function statusType(status: string): string {
  if (status === 'SUCCESS' || status === 'RESOLVED') return 'success'
  if (status === 'DIFF') return 'danger'
  return 'warning'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchReconcileBills({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status ? { status: query.status } : {})
    })
    bills.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载对账单失败')
  } finally {
    loading.value = false
  }
}

function openImport(): void {
  Object.assign(form, {
    storeId: 0, billNo: '', channel: 'WECHAT', period: '',
    platformAmount: '0', localAmount: '0', currency: 'CNY'
  })
  importVisible.value = true
}

function openResolve(id: number): void {
  currentBillId.value = id
  resolveForm.note = ''
  resolveVisible.value = true
}

async function handleImport(): Promise<void> {
  try {
    const result = await importReconcileBills([{ ...form }])
    const diff = result.filter((item) => item.status === 'DIFF').length
    importVisible.value = false
    ElMessage.success(`导入 ${result.length} 条，差异 ${diff} 条`)
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '导入失败')
  }
}

async function handleResolve(): Promise<void> {
  try {
    await resolveReconcileBill(currentBillId.value, resolveForm.note)
    resolveVisible.value = false
    ElMessage.success('差异已处理')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '处理失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>支付对账</h2>
      <p>导入平台账单按金额自动识别差异，差异账单需填写处理说明后才能结案。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-select v-model="query.status" placeholder="状态" clearable style="width: 140px" @change="load">
          <el-option label="一致" value="SUCCESS" />
          <el-option label="差异" value="DIFF" />
          <el-option label="待确认" value="PENDING" />
          <el-option label="已处理" value="RESOLVED" />
        </el-select>
        <el-button type="primary" v-perm="'shop:payment:reconcile'" @click="openImport">导入账单</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="bills" row-key="id">
        <el-table-column prop="billNo" label="账单号" min-width="160" />
        <el-table-column prop="storeId" label="店铺 ID" width="90" />
        <el-table-column prop="channel" label="渠道" width="110" />
        <el-table-column prop="period" label="账期" width="110" />
        <el-table-column prop="platformAmount" label="平台金额" width="130" />
        <el-table-column prop="localAmount" label="本地金额" width="130" />
        <el-table-column prop="diffAmount" label="差异金额" width="130" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }"><el-tag :type="statusType(row.status)">{{ row.status }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="diffReason" label="差异说明" min-width="180" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'DIFF'" link type="primary" v-perm="'shop:payment:reconcile'" @click="openResolve(row.id)">处理</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="importVisible" title="导入平台账单" width="520px">
      <el-form label-width="100px">
        <el-form-item label="店铺 ID"><el-input-number v-model="form.storeId" :min="1" /></el-form-item>
        <el-form-item label="账单号"><el-input v-model="form.billNo" /></el-form-item>
        <el-form-item label="渠道"><el-input v-model="form.channel" /></el-form-item>
        <el-form-item label="账期"><el-date-picker v-model="form.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  /></el-form-item>
        <el-form-item label="平台金额"><el-input v-model="form.platformAmount" /></el-form-item>
        <el-form-item label="本地金额"><el-input v-model="form.localAmount" /></el-form-item>
        <el-form-item label="币种"><el-input v-model="form.currency" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" @click="handleImport">导入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="resolveVisible" title="处理对账差异" width="480px">
      <el-form label-width="90px">
        <el-form-item label="处理说明"><el-input v-model="resolveForm.note" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resolveVisible = false">取消</el-button>
        <el-button type="primary" @click="handleResolve">确认处理</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
