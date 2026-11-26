<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  approveShift,
  closeShift,
  fetchCurrentShift,
  fetchPosShifts,
  openShift,
  type PosShift
} from '@/api/sales-delivery'

const shifts = ref<PosShift[]>([])
const current = ref<PosShift | null>(null)
const loading = ref(false)

const openDialog = ref(false)
const closeDialog = ref(false)
const openForm = ref({ storeName: '', openingCash: '0' })
const closeForm = ref({ actualCash: '0', otherIncome: '0', remark: '' })

function money(value: string | number | null | undefined): string {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00'
}

function levelTag(level: string): string {
  return level === 'ALARM' ? 'danger' : level === 'WARN' ? 'warning' : 'success'
}

function statusTag(status: string): string {
  return status === 'CLOSED' ? 'success' : status === 'PENDING_APPROVAL' ? 'warning' : 'info'
}

function statusText(status: string): string {
  return status === 'OPEN' ? '营业中' : status === 'PENDING_APPROVAL' ? '待审批' : '已交班'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const [list, active] = await Promise.all([fetchPosShifts({ page: 1, pageSize: 50 }), fetchCurrentShift()])
    shifts.value = list.list
    current.value = active
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function submitOpen(): Promise<void> {
  try {
    await openShift({ storeName: openForm.value.storeName || undefined, openingCash: openForm.value.openingCash || '0' })
    openDialog.value = false
    openForm.value = { storeName: '', openingCash: '0' }
    ElMessage.success('已开班')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '开班失败')
  }
}

async function submitClose(): Promise<void> {
  if (!current.value) return
  try {
    const shift = await closeShift(current.value.id, {
      actualCash: closeForm.value.actualCash || '0',
      otherIncome: closeForm.value.otherIncome || '0',
      remark: closeForm.value.remark || undefined
    })
    closeDialog.value = false
    closeForm.value = { actualCash: '0', otherIncome: '0', remark: '' }
    if (shift.status === 'PENDING_APPROVAL') {
      ElMessage.warning('现金差异较大，班次已转主管审批')
    } else {
      ElMessage.success('已交班')
    }
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '交班失败')
  }
}

async function submitApprove(row: PosShift): Promise<void> {
  let remark = ''
  try {
    const { value } = await ElMessageBox.prompt('请填写审批说明', '差异班次审批', {
      inputValidator: (input: string) => (input && input.trim() ? true : '审批说明必填')
    })
    remark = value
  } catch {
    return
  }
  try {
    await approveShift(row.id, remark)
    ElMessage.success('审批完成')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '审批失败')
  }
}

onMounted(load)
</script>

<template>
  <div class="shift-page" v-loading="loading">
    <section class="board">
      <div class="board-head">
        <div>
          <h2>当前班次</h2>
          <p class="sub">{{ current ? `班号 ${current.shiftNo} · 开班于 ${current.openAt}` : '当前没有未交班的班次' }}</p>
        </div>
        <div class="board-actions">
          <el-button v-if="!current" type="primary" @click="openDialog = true">开班</el-button>
          <el-button v-if="current" type="warning" @click="closeDialog = true">交班</el-button>
        </div>
      </div>
      <div class="metric-row">
        <div class="metric">
          <span class="label">开班备用金</span>
          <strong>{{ money(current?.openingCash) }}</strong>
        </div>
        <div class="metric">
          <span class="label">本班现金收款</span>
          <strong>{{ money(current?.cashReceived) }}</strong>
        </div>
        <div class="metric">
          <span class="label">本班订单</span>
          <strong>{{ current?.orderCount ?? 0 }}<i> 笔 / {{ money(current?.orderAmount) }}</i></strong>
        </div>
        <div class="metric" :class="{ alarm: current && Number(current.differenceAmount) !== 0 }">
          <span class="label">现金差异</span>
          <strong>{{ money(current?.differenceAmount) }}</strong>
        </div>
      </div>
      <div v-if="current?.paymentSummary?.length" class="pay-summary">
        <span v-for="item in current.paymentSummary" :key="item.payType" class="pay-chip">
          {{ item.payType }} · {{ money(item.amount) }}（{{ item.count }} 笔）
        </span>
      </div>
    </section>

    <section class="history">
      <el-table :data="shifts" border size="small">
        <el-table-column prop="shiftNo" label="班号" width="170" />
        <el-table-column prop="storeName" label="门店" width="120" />
        <el-table-column label="开班时间" width="180">
          <template #default="{ row }">{{ row.openAt }}</template>
        </el-table-column>
        <el-table-column label="备用金" width="110">
          <template #default="{ row }">{{ money(row.openingCash) }}</template>
        </el-table-column>
        <el-table-column label="现金收款" width="110">
          <template #default="{ row }">{{ money(row.cashReceived) }}</template>
        </el-table-column>
        <el-table-column label="应存 / 实盘" width="170">
          <template #default="{ row }">{{ money(row.expectedCash) }} / {{ money(row.actualCash) }}</template>
        </el-table-column>
        <el-table-column label="差异" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="levelTag(row.level)">{{ money(row.differenceAmount) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTag(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="差异说明" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'PENDING_APPROVAL'" size="small" type="primary" @click="submitApprove(row)">审批</el-button>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="openDialog" title="POS 开班" width="420px">
      <el-form label-width="90px">
        <el-form-item label="门店"><el-input v-model="openForm.storeName" placeholder="选填" /></el-form-item>
        <el-form-item label="备用金"><el-input v-model="openForm.openingCash" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="openDialog = false">取消</el-button>
        <el-button type="primary" @click="submitOpen">开班</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="closeDialog" title="POS 交班" width="460px">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
        <template #title>
          应存现金 = 备用金 + 本班现金收款 + 其他现金收入；现金存在差异时必须填写差异说明。
        </template>
      </el-alert>
      <el-form label-width="100px">
        <el-form-item label="实盘现金"><el-input v-model="closeForm.actualCash" /></el-form-item>
        <el-form-item label="其他收入"><el-input v-model="closeForm.otherIncome" /></el-form-item>
        <el-form-item label="差异说明"><el-input v-model="closeForm.remark" type="textarea" placeholder="无差异可留空" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeDialog = false">取消</el-button>
        <el-button type="warning" @click="submitClose">确认交班</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.shift-page { display: flex; flex-direction: column; gap: 12px; }
.board {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 14px 16px;
}
.board-head { display: flex; align-items: flex-start; justify-content: space-between; }
.board-head h2 { margin: 0; font-size: 16px; }
.sub { margin: 4px 0 0; font-size: 12px; color: var(--el-text-color-secondary); }
.metric-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 14px; }
.metric {
  background: var(--el-fill-color-light);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.metric.alarm { background: var(--el-color-danger-light-9); }
.metric .label { font-size: 12px; color: var(--el-text-color-secondary); }
.metric strong { font-size: 18px; }
.metric strong i { font-size: 12px; font-style: normal; color: var(--el-text-color-secondary); }
.pay-summary { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
.pay-chip {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 10px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.history { background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 12px; }
.muted { color: var(--el-text-color-secondary); }
</style>
