<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  approveRefund, createRefund, fetchRefunds, rejectRefund, type ShopRefund
} from '@/api/shop'
import type { PageQuery } from '@/types/contract'

const refunds = ref<ShopRefund[]>([])
const total = ref(0)
const loading = ref(false)
const createVisible = ref(false)
const approveVisible = ref(false)
const rejectVisible = ref(false)
const currentRefundId = ref(0)
const query = reactive<PageQuery & { status?: string }>({ page: 1, pageSize: 20, status: '' })
const form = reactive({ storeId: 0, shopOrderId: 0, amount: '0', reason: '' })
const approveForm = reactive({ redInvoiceNo: '', note: '' })
const rejectForm = reactive({ note: '' })

function statusType(status: string): string {
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'danger'
  return 'warning'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchRefunds({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status ? { status: query.status } : {})
    })
    refunds.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载退款单失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, { storeId: 0, shopOrderId: 0, amount: '0', reason: '' })
  createVisible.value = true
}

function openApprove(id: number): void {
  currentRefundId.value = id
  Object.assign(approveForm, { redInvoiceNo: '', note: '' })
  approveVisible.value = true
}

function openReject(id: number): void {
  currentRefundId.value = id
  rejectForm.note = ''
  rejectVisible.value = true
}

async function handleCreate(): Promise<void> {
  try {
    await createRefund({ ...form })
    createVisible.value = false
    ElMessage.success('退款申请已提交')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '提交失败')
  }
}

async function handleApprove(): Promise<void> {
  try {
    await approveRefund(currentRefundId.value, { ...approveForm })
    approveVisible.value = false
    ElMessage.success('退款已审批，已生成销售退货与红字凭证')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '审批失败')
  }
}

async function handleReject(): Promise<void> {
  try {
    await rejectRefund(currentRefundId.value, rejectForm.note)
    rejectVisible.value = false
    ElMessage.success('退款已驳回')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '驳回失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>退款审批</h2>
      <p>退款申请按订单实付金额校验，可退余额不足直接拒绝；审批后生成销售退货与红字凭证。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-select v-model="query.status" placeholder="状态" clearable style="width: 140px" @change="load">
          <el-option label="待审批" value="SUBMITTED" />
          <el-option label="已通过" value="APPROVED" />
          <el-option label="已驳回" value="REJECTED" />
        </el-select>
        <el-button type="primary" v-perm="'shop:refund:create'" @click="openCreate">新增退款</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="refunds" row-key="id">
        <el-table-column prop="refundNo" label="退款单号" min-width="170" />
        <el-table-column prop="storeId" label="店铺 ID" width="90" />
        <el-table-column prop="shopOrderId" label="商城订单" width="100" />
        <el-table-column prop="amount" label="退款金额" width="130" />
        <el-table-column prop="reason" label="原因" min-width="160" />
        <el-table-column prop="saleReturnId" label="销售退货单" width="110" />
        <el-table-column prop="redInvoiceNo" label="红字发票" width="130" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }"><el-tag :type="statusType(row.status)">{{ row.status }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'SUBMITTED'">
              <el-button link type="primary" v-perm="'shop:refund:approve'" @click="openApprove(row.id)">审批</el-button>
              <el-button link type="danger" v-perm="'shop:refund:approve'" @click="openReject(row.id)">驳回</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="createVisible" title="新增退款申请" width="520px">
      <el-form label-width="100px">
        <el-form-item label="店铺 ID"><el-input-number v-model="form.storeId" :min="1" /></el-form-item>
        <el-form-item label="商城订单 ID"><el-input-number v-model="form.shopOrderId" :min="1" /></el-form-item>
        <el-form-item label="退款金额"><el-input v-model="form.amount" /></el-form-item>
        <el-form-item label="退款原因"><el-input v-model="form.reason" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="approveVisible" title="审批退款" width="480px">
      <el-form label-width="100px">
        <el-form-item label="红字发票号"><el-input v-model="approveForm.redInvoiceNo" /></el-form-item>
        <el-form-item label="审批说明"><el-input v-model="approveForm.note" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveVisible = false">取消</el-button>
        <el-button type="primary" @click="handleApprove">通过</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rejectVisible" title="驳回退款" width="460px">
      <el-form label-width="90px">
        <el-form-item label="驳回原因"><el-input v-model="rejectForm.note" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" @click="handleReject">驳回</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
