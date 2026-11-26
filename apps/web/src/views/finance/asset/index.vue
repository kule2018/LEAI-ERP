<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  changeAsset, createAsset, fetchAssetChanges, fetchAssets, fetchDepreciationLedger, runDepreciation,
  type Asset, type AssetChange, type DepreciationLedger, type FinanceQuery
} from '@/api/finance'

const rows = ref<Asset[]>([])
const changes = ref<AssetChange[]>([])
const ledger = ref<DepreciationLedger | null>(null)
const total = ref(0)
const loading = ref(false)
const query = ref<FinanceQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({
  assetNo: '', assetName: '', originalValue: '0', usefulMonths: 0, purchaseDate: '',
  depreciationMethod: 'STRAIGHT_LINE', residualRate: '0', expenseSubjectId: undefined as number | undefined,
  accumulatedSubjectId: undefined as number | undefined
})
const voucherOptions = reactive({ withVoucher: false, expenseSubjectId: undefined as number | undefined, accumulatedSubjectId: undefined as number | undefined })
const changeVisible = ref(false)
const changeForm = reactive({ id: 0, assetName: '', originalValue: '', usefulMonths: 0, changeType: 'INFO_CHANGE', reason: '' })
const period = ref(new Date().toISOString().slice(0, 7))
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchAssets(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
async function loadChanges(): Promise<void> {
  try { const result = await fetchAssetChanges({ page: 1, pageSize: 50, keyword: '' }); changes.value = result.list }
  catch { changes.value = [] }
}
/** 折旧台账：明细 + 折旧/净值汇总 */
async function loadLedger(): Promise<void> {
  try {
    ledger.value = await fetchDepreciationLedger({ period: period.value, page: 1, pageSize: 100 })
  } catch {
    ledger.value = null
  }
}
function openAdd(): void {
  Object.assign(form, {
    assetNo: '', assetName: '', originalValue: '0', usefulMonths: 0, purchaseDate: '',
    depreciationMethod: 'STRAIGHT_LINE', residualRate: '0', expenseSubjectId: undefined, accumulatedSubjectId: undefined
  })
  visible.value = true
}
async function save(): Promise<void> {
  try {
    await createAsset({ ...form, purchaseDate: form.purchaseDate || undefined })
    visible.value = false
    ElMessage.success('资产已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function handleDepreciation(): Promise<void> {
  try {
    const result = await runDepreciation(period.value, {
      withVoucher: voucherOptions.withVoucher,
      expenseSubjectId: voucherOptions.expenseSubjectId,
      accumulatedSubjectId: voucherOptions.accumulatedSubjectId
    })
    ElMessage.success(`折旧已计提：${result.records.length} 项，合计 ${result.totalAmount}，生成凭证 ${result.voucherIds.length} 张`)
    await load()
    await loadLedger()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '计提失败') }
}
function openChange(row: Asset): void {
  Object.assign(changeForm, { id: row.id, assetName: row.assetName, originalValue: row.originalValue, usefulMonths: row.usefulMonths, changeType: 'INFO_CHANGE', reason: '' })
  changeVisible.value = true
}
async function submitChange(): Promise<void> {
  try {
    await changeAsset(changeForm.id, {
      changeType: changeForm.changeType,
      assetName: changeForm.assetName || undefined,
      originalValue: changeForm.originalValue || undefined,
      usefulMonths: changeForm.usefulMonths,
      reason: changeForm.reason || undefined
    })
    changeVisible.value = false
    ElMessage.success('资产变更已记录')
    await load()
    await loadChanges()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '变更失败') }
}
onMounted(async () => { await load(); await loadChanges(); await loadLedger() })
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>固定资产</h2><p>资产卡片、折旧计提、变更留痕和处置记录。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'finance:asset:create'" @click="openAdd">新增资产</el-button>
        <el-date-picker v-model="period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  />
        <el-checkbox v-model="voucherOptions.withVoucher">生成凭证</el-checkbox>
        <el-input-number v-if="voucherOptions.withVoucher" v-model="voucherOptions.expenseSubjectId" :min="1" placeholder="费用科目ID" style="width: 150px" />
        <el-input-number v-if="voucherOptions.withVoucher" v-model="voucherOptions.accumulatedSubjectId" :min="1" placeholder="累计折旧科目ID" style="width: 160px" />
        <el-button v-perm="'finance:asset:depreciate'" @click="handleDepreciation">计提折旧</el-button>
        <el-button @click="loadLedger">刷新台账</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="assetNo" label="资产编号" width="150" />
        <el-table-column prop="assetName" label="资产名称" min-width="180" />
        <el-table-column prop="originalValue" label="原值" width="150" />
        <el-table-column prop="depreciatedValue" label="累计折旧" width="150" />
        <el-table-column prop="netValue" label="账面净值" width="150" />
        <el-table-column prop="usefulMonths" label="使用月数" width="120" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="scope">
            <el-button link type="primary" v-perm="'finance:asset:update'" @click="openChange(scope.row)">变更</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>
    <article class="panel">
      <h3>折旧台账（{{ period }}）</h3>
      <el-descriptions v-if="ledger" :column="5" border size="small" style="margin-bottom: 12px">
        <el-descriptions-item label="本期折旧">{{ ledger.summary.periodAmount }}</el-descriptions-item>
        <el-descriptions-item label="累计折旧">{{ ledger.summary.accumulatedAmount }}</el-descriptions-item>
        <el-descriptions-item label="资产净值合计">{{ ledger.summary.netValueAmount }}</el-descriptions-item>
        <el-descriptions-item label="已计提资产">{{ ledger.summary.depreciatedAssetCount }} / {{ ledger.summary.assetCount }}</el-descriptions-item>
        <el-descriptions-item label="未计提资产">
          <span :class="{ danger: ledger.summary.missingAssetCount > 0 }">{{ ledger.summary.missingAssetCount }} 项</span>
        </el-descriptions-item>
      </el-descriptions>
      <el-alert
        v-if="ledger && ledger.summary.missingAssetCount > 0"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 12px"
        :title="`以下资产本期应计提但未计提，将阻断月结：${ledger.summary.missingAssetNos.join('、')}`"
      />
      <el-table :data="ledger?.rows ?? []" row-key="id" size="small">
        <el-table-column prop="assetNo" label="资产编号" width="150" />
        <el-table-column prop="assetName" label="资产名称" min-width="160" />
        <el-table-column prop="method" label="折旧方法" width="130" />
        <el-table-column prop="period" label="期间" width="100" />
        <el-table-column prop="amount" label="折旧额" width="120" />
        <el-table-column prop="originalValue" label="原值" width="120" />
        <el-table-column prop="depreciatedValue" label="累计折旧" width="120" />
        <el-table-column prop="netValue" label="账面净值" width="120" />
      </el-table>
    </article>
    <article class="panel">
      <h3>变更记录</h3>
      <el-table :data="changes" row-key="id">
        <el-table-column prop="assetId" label="资产ID" width="100" />
        <el-table-column prop="changeType" label="变更类型" width="140" />
        <el-table-column label="变更明细" min-width="280">
          <template #default="scope">
            <span v-for="item in scope.row.changes ?? []" :key="item.field" style="margin-right: 12px">
              {{ item.label }}：{{ item.before ?? '-' }} → {{ item.after ?? '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="原因" min-width="160" />
        <el-table-column prop="createdAt" label="变更时间" width="200" />
      </el-table>
    </article>
    <el-dialog v-model="visible" title="新增固定资产" width="520px">
      <el-form label-width="90px">
        <el-form-item label="资产编号"><el-input v-model="form.assetNo" /></el-form-item>
        <el-form-item label="资产名称"><el-input v-model="form.assetName" /></el-form-item>
        <el-form-item label="原值"><el-input v-model="form.originalValue" /></el-form-item>
        <el-form-item label="使用月数"><el-input-number v-model="form.usefulMonths" :min="0" /></el-form-item>
        <el-form-item label="购置日期"><el-date-picker v-model="form.purchaseDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="折旧方法">
          <el-select v-model="form.depreciationMethod" style="width: 100%">
            <el-option label="平均年限法" value="STRAIGHT_LINE" />
            <el-option label="双倍余额递减法" value="DOUBLE_DECLINING" />
            <el-option label="年数总和法" value="SUM_OF_YEARS" />
          </el-select>
        </el-form-item>
        <el-form-item label="残值率"><el-input v-model="form.residualRate" placeholder="0~1，如 0.05" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="changeVisible" title="资产变更" width="560px">
      <el-form label-width="100px">
        <el-form-item label="变更类型">
          <el-select v-model="changeForm.changeType" style="width: 100%">
            <el-option label="信息变更" value="INFO_CHANGE" />
            <el-option label="折旧规则变更" value="DEPRECIATION_CHANGE" />
            <el-option label="使用部门变更" value="DEPARTMENT_CHANGE" />
          </el-select>
        </el-form-item>
        <el-form-item label="资产名称"><el-input v-model="changeForm.assetName" /></el-form-item>
        <el-form-item label="原值"><el-input v-model="changeForm.originalValue" /></el-form-item>
        <el-form-item label="使用月数"><el-input-number v-model="changeForm.usefulMonths" :min="0" /></el-form-item>
        <el-form-item label="变更原因"><el-input v-model="changeForm.reason" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="changeVisible = false">取消</el-button><el-button type="primary" @click="submitChange">提交变更</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.panel h3 { margin: 0 0 12px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.danger { color: #f56c6c; font-weight: 600; }
</style>
