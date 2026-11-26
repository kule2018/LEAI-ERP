<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createAdminAsset, fetchAdminAssets, type AdminAsset, type CollabQuery } from '@/api/collaboration'
import {
  assetAction, createAssetRepair, createStocktake, fetchAssetRepairs, fetchStocktakes, finishAssetRepair,
  submitStocktake, type AssetRepairRow, type StocktakeRow
} from '@/api/hr-approval'

const rows = ref<AdminAsset[]>([])
const stocktakes = ref<StocktakeRow[]>([])
const repairs = ref<AssetRepairRow[]>([])
const loading = ref(false)
const query = ref<CollabQuery>({ page: 1, pageSize: 20 })
const form = reactive({ assetNo: '', assetName: '', holderId: 0 })
const stocktakeForm = reactive({ stocktakeDate: '', remark: '' })
const repairForm = reactive({ assetId: 0, repairType: 'MAINTENANCE', repairReason: '', vendor: '', amount: '0', repairDate: '' })
const holderForm = reactive({ assetId: 0, holderId: 0 })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const [asset, stocktake, repair] = await Promise.all([
      fetchAdminAssets(query.value), fetchStocktakes(query.value), fetchAssetRepairs(query.value)
    ])
    if (current !== seq) return
    rows.value = asset.list
    stocktakes.value = stocktake.list
    repairs.value = repair.list
  } finally { if (current === seq) loading.value = false }
}
async function run(fn: () => Promise<unknown>, message: string): Promise<void> {
  try { await fn(); ElMessage.success(message); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '操作失败') }
}
async function save(): Promise<void> {
  try {
    await createAdminAsset({ ...form, holderId: form.holderId || undefined })
    ElMessage.success('资产已保存')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
function issue(row: AdminAsset): void {
  void run(() => assetAction({ assetId: row.id, action: 'ISSUE', holderId: holderForm.holderId || undefined }), '领用已登记')
}
function giveBack(row: AdminAsset): void {
  void run(() => assetAction({ assetId: row.id, action: 'RETURN' }), '归还已登记')
}
function countStocktake(row: StocktakeRow): void {
  void run(() => submitStocktake(row.id, rows.value.map((asset) => ({ assetId: asset.id, actualStatus: asset.status, actualHolderId: asset.holderId ?? undefined }))), '盘点结果已提交')
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>行政资产</h2><p>办公资产台账和领用记录。</p></header>
    <el-tabs>
      <el-tab-pane label="资产台账">
        <el-form inline>
          <el-form-item label="资产编号"><el-input v-model="form.assetNo" /></el-form-item>
          <el-form-item label="资产名称"><el-input v-model="form.assetName" /></el-form-item>
          <el-form-item label="领用人ID"><el-input-number v-model="form.holderId" :min="0" /></el-form-item>
          <el-button type="primary" v-perm="'hr:admin-asset:create'" @click="save">保存</el-button>
          <el-form-item label="领用给ID"><el-input-number v-model="holderForm.holderId" :min="0" /></el-form-item>
        </el-form>
        <el-table v-loading="loading" :data="rows" row-key="id" size="small">
          <el-table-column prop="assetNo" label="资产编号" width="160" />
          <el-table-column prop="assetName" label="资产名称" min-width="200" />
          <el-table-column prop="holderId" label="领用人" width="110" />
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'hr:admin-asset:update'" @click="issue(row)">领用</el-button>
              <el-button link type="danger" v-perm="'hr:admin-asset:update'" @click="giveBack(row)">归还</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="资产盘点">
        <el-form inline>
          <el-form-item label="盘点日期"><el-date-picker v-model="stocktakeForm.stocktakeDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
          <el-form-item label="备注"><el-input v-model="stocktakeForm.remark" /></el-form-item>
          <el-button type="primary" v-perm="'hr:admin-asset:create'" @click="run(() => createStocktake({ ...stocktakeForm }), '盘点单已创建')">新建盘点</el-button>
        </el-form>
        <el-table :data="stocktakes" row-key="id" size="small">
          <el-table-column prop="stocktakeNo" label="盘点单号" width="180" />
          <el-table-column prop="stocktakeDate" label="盘点日期" width="130" />
          <el-table-column prop="totalCount" label="账面数" width="100" />
          <el-table-column prop="diffCount" label="差异数" width="100" />
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'hr:admin-asset:update'" @click="countStocktake(row)">提交盘点</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="维修台账">
        <el-form inline>
          <el-form-item label="资产ID"><el-input-number v-model="repairForm.assetId" :min="1" /></el-form-item>
          <el-form-item label="类型"><el-input v-model="repairForm.repairType" /></el-form-item>
          <el-form-item label="原因"><el-input v-model="repairForm.repairReason" /></el-form-item>
          <el-form-item label="供应商"><el-input v-model="repairForm.vendor" /></el-form-item>
          <el-form-item label="金额"><el-input v-model="repairForm.amount" /></el-form-item>
          <el-form-item label="日期"><el-date-picker v-model="repairForm.repairDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
          <el-button type="primary" v-perm="'hr:admin-asset:create'" @click="run(() => createAssetRepair({ ...repairForm }), '维修记录已登记')">登记维修</el-button>
        </el-form>
        <el-table :data="repairs" row-key="id" size="small">
          <el-table-column prop="assetId" label="资产ID" width="100" />
          <el-table-column prop="repairType" label="类型" width="120" />
          <el-table-column prop="repairReason" label="原因" min-width="200" />
          <el-table-column prop="vendor" label="供应商" width="140" />
          <el-table-column prop="amount" label="金额" width="110" />
          <el-table-column prop="repairDate" label="日期" width="120" />
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column label="操作" width="110" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'hr:admin-asset:update'" @click="run(() => finishAssetRepair(row.id, {}), '维修已完工')">完工</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
</style>
