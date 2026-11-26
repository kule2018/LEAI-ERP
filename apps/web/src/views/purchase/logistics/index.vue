<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createCarrier, createWaybill, fetchCarriers, fetchWaybills } from '@/api/purchase'
import { addTrackNode, listTrackNodes, reconcileFreight, reportWaybillException } from '@/api/purchase-extension'
import type { PageQuery } from '@/types/contract'

const carriers = ref<Array<Record<string, unknown>>>([])
const waybills = ref<Array<Record<string, unknown>>>([])
const loading = ref(false)
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const carrierVisible = ref(false)
const waybillVisible = ref(false)
const carrierForm = reactive({ carrierCode: '', carrierName: '', contactPhone: '' })
const waybillForm = reactive({ waybillNo: '', carrierId: 0, sourceType: '', sourceId: 0 })

/** 轨迹与对账弹窗 */
const trackVisible = ref(false)
const trackNodes = ref<Array<Record<string, unknown>>>([])
const trackForm = reactive({ waybillId: 0, nodeName: '', nodeTime: '', location: '', status: 'NORMAL' })
const exceptionForm = reactive({ waybillId: 0, reason: '', status: 'EXCEPTION', signer: '' })
const freightForm = reactive({ waybillId: 0, declaredAmount: '0', settledAmount: '0' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const [carrierResult, waybillResult] = await Promise.all([fetchCarriers(query.value), fetchWaybills(query.value)])
    if (current !== seq) return
    carriers.value = carrierResult.list as unknown as Array<Record<string, unknown>>
    waybills.value = waybillResult.list as unknown as Array<Record<string, unknown>>
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
  finally { if (current === seq) loading.value = false }
}
function openCarrier(): void { Object.assign(carrierForm, { carrierCode: '', carrierName: '', contactPhone: '' }); carrierVisible.value = true }
function openWaybill(): void { Object.assign(waybillForm, { waybillNo: '', carrierId: 0, sourceType: '', sourceId: 0 }); waybillVisible.value = true }
async function saveCarrier(): Promise<void> {
  try { await createCarrier({ ...carrierForm }); carrierVisible.value = false; ElMessage.success('承运商已创建'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function saveWaybill(): Promise<void> {
  try {
    await createWaybill({ waybillNo: waybillForm.waybillNo, carrierId: waybillForm.carrierId, sourceType: waybillForm.sourceType || undefined, sourceId: waybillForm.sourceId || undefined })
    waybillVisible.value = false
    ElMessage.success('运单已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}

/** 打开运单轨迹 */
async function openTrack(row: unknown): Promise<void> {
  const waybill = row as { id: number; waybillNo: string }
  trackForm.waybillId = waybill.id
  Object.assign(trackForm, { nodeName: '', nodeTime: '', location: '', status: 'NORMAL' })
  trackVisible.value = true
  await refreshTrack()
}

async function refreshTrack(): Promise<void> {
  if (!trackForm.waybillId) return
  try {
    const result = await listTrackNodes(trackForm.waybillId)
    trackNodes.value = result as unknown as Array<Record<string, unknown>>
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '轨迹加载失败') }
}

async function submitTrack(): Promise<void> {
  if (!trackForm.nodeName || !trackForm.nodeTime) { ElMessage.warning('请填写节点名称与时间'); return }
  try {
    await addTrackNode(trackForm.waybillId, {
      nodeName: trackForm.nodeName,
      nodeTime: trackForm.nodeTime,
      location: trackForm.location || undefined,
      status: trackForm.status
    })
    ElMessage.success('轨迹节点已登记')
    Object.assign(trackForm, { nodeName: '', nodeTime: '', location: '', status: 'NORMAL' })
    await refreshTrack()
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '轨迹登记失败') }
}

async function submitException(): Promise<void> {
  if (!exceptionForm.reason) { ElMessage.warning('请填写异常原因'); return }
  try {
    await reportWaybillException(exceptionForm.waybillId, {
      reason: exceptionForm.reason,
      status: exceptionForm.status,
      signer: exceptionForm.signer || undefined
    })
    ElMessage.success('异常签收已登记')
    Object.assign(exceptionForm, { reason: '', status: 'EXCEPTION', signer: '' })
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '异常登记失败') }
}

async function submitFreight(): Promise<void> {
  try {
    await reconcileFreight(freightForm.waybillId, {
      declaredAmount: freightForm.declaredAmount,
      settledAmount: freightForm.settledAmount
    })
    ElMessage.success('运费对账完成')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '运费对账失败') }
}

onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>物流运单</h2><p>维护承运商和运单轨迹，异常签收与运费对账可追踪到采购收货。</p></header>
    <div class="logistics-layout">
      <article class="panel">
        <div class="panel-head"><h3>承运商</h3><el-button type="primary" size="small" v-perm="'purchase:logistics:create'" @click="openCarrier">新增</el-button></div>
        <el-table v-loading="loading" :data="carriers" size="small" row-key="id">
          <el-table-column prop="carrierCode" label="编码" width="120" />
          <el-table-column prop="carrierName" label="名称" min-width="140" />
          <el-table-column prop="contactPhone" label="联系电话" width="140" />
          <el-table-column prop="status" label="状态" width="100" />
        </el-table>
      </article>
      <article class="panel">
        <div class="panel-head"><h3>运单</h3><el-button type="primary" size="small" v-perm="'purchase:logistics:create'" @click="openWaybill">新增</el-button></div>
        <el-table v-loading="loading" :data="waybills" size="small" row-key="id">
          <el-table-column prop="waybillNo" label="运单号" width="180" />
          <el-table-column prop="carrierId" label="承运商ID" width="110" />
          <el-table-column prop="sourceType" label="来源" width="120" />
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column label="操作" width="230" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'purchase:logistics:track'" @click="openTrack(row)">轨迹</el-button>
              <el-button link type="warning" v-perm="'purchase:logistics:track'" @click="exceptionForm.waybillId = row.id">异常</el-button>
              <el-button link type="success" v-perm="'purchase:logistics:reconcile'" @click="freightForm.waybillId = row.id">运费对账</el-button>
            </template>
          </el-table-column>
        </el-table>
      </article>
    </div>

    <el-dialog v-model="carrierVisible" title="新增承运商" width="480px">
      <el-form label-width="90px">
        <el-form-item label="编码"><el-input v-model="carrierForm.carrierCode" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="carrierForm.carrierName" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="carrierForm.contactPhone" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="carrierVisible = false">取消</el-button><el-button type="primary" @click="saveCarrier">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="waybillVisible" title="新增运单" width="520px">
      <el-form label-width="90px">
        <el-form-item label="运单号"><el-input v-model="waybillForm.waybillNo" /></el-form-item>
        <el-form-item label="承运商ID"><el-input-number v-model="waybillForm.carrierId" :min="1" /></el-form-item>
        <el-form-item label="来源类型"><el-input v-model="waybillForm.sourceType" placeholder="PURCHASE_RECEIPT" /></el-form-item>
        <el-form-item label="来源ID"><el-input-number v-model="waybillForm.sourceId" :min="0" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="waybillVisible = false">取消</el-button><el-button type="primary" @click="saveWaybill">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="trackVisible" title="运单轨迹" width="720px">
      <el-form label-width="90px">
        <el-form-item label="节点名称"><el-input v-model="trackForm.nodeName" /></el-form-item>
        <el-form-item label="节点时间"><el-date-picker v-model="trackForm.nodeTime" type="datetime" value-format="YYYY-MM-DD HH:mm" placeholder="2026-11-20 10:00"  /></el-form-item>
        <el-form-item label="地点"><el-input v-model="trackForm.location" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="trackForm.status" style="width: 180px">
            <el-option label="正常" value="NORMAL" />
            <el-option label="异常" value="EXCEPTION" />
            <el-option label="拒收" value="REJECTED" />
            <el-option label="丢失" value="LOST" />
            <el-option label="破损" value="DAMAGED" />
            <el-option label="已签收" value="DELIVERED" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-button type="primary" v-perm="'purchase:logistics:track'" @click="submitTrack">登记节点</el-button>
      <el-table :data="trackNodes" size="small" border class="track-table">
        <el-table-column prop="nodeName" label="节点" width="140" />
        <el-table-column prop="nodeTime" label="时间" width="160" />
        <el-table-column prop="location" label="地点" min-width="140" />
        <el-table-column prop="status" label="状态" width="110" />
      </el-table>
    </el-dialog>

    <el-dialog title="异常签收登记" width="480px">
      <el-form label-width="90px">
        <el-form-item label="运单ID"><el-input-number v-model="exceptionForm.waybillId" :min="1" /></el-form-item>
        <el-form-item label="异常原因"><el-input v-model="exceptionForm.reason" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="异常类型">
          <el-select v-model="exceptionForm.status" style="width: 180px">
            <el-option label="异常" value="EXCEPTION" />
            <el-option label="拒收" value="REJECTED" />
            <el-option label="丢失" value="LOST" />
            <el-option label="破损" value="DAMAGED" />
          </el-select>
        </el-form-item>
        <el-form-item label="签收人"><el-input v-model="exceptionForm.signer" /></el-form-item>
      </el-form>
      <template #footer><el-button type="primary" v-perm="'purchase:logistics:track'" @click="submitException">登记</el-button></template>
    </el-dialog>

    <el-dialog title="运费对账" width="480px">
      <el-form label-width="90px">
        <el-form-item label="运单ID"><el-input-number v-model="freightForm.waybillId" :min="1" /></el-form-item>
        <el-form-item label="申报运费"><el-input v-model="freightForm.declaredAmount" /></el-form-item>
        <el-form-item label="结算运费"><el-input v-model="freightForm.settledAmount" /></el-form-item>
      </el-form>
      <template #footer><el-button type="primary" v-perm="'purchase:logistics:reconcile'" @click="submitFreight">对账</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.logistics-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.panel-head h3 { margin: 0; }
.track-table { margin-top: 12px; }
@media (max-width: 1100px) { .logistics-layout { grid-template-columns: 1fr; } }
</style>
