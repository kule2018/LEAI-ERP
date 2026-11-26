<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchShipments, type Shipment } from '@/api/sales'
import {
  addTrackingNode,
  fetchShipmentExceptions,
  fetchShipmentTimeline,
  fetchShippableWaves,
  handleShipmentException,
  linkShipmentWave,
  registerShipmentException,
  type PickWaveState,
  type ShipmentException,
  type TrackingNode
} from '@/api/sales-delivery'

const EXCEPTION_TYPES = [
  { value: 'REJECTED', label: '客户拒收' },
  { value: 'DAMAGED', label: '货物破损' },
  { value: 'LOST', label: '货物丢失' },
  { value: 'DELAY', label: '配送延误' },
  { value: 'SHORTAGE', label: '数量短少' },
  { value: 'OTHER', label: '其他异常' }
]

const NODE_OPTIONS = [
  { value: 'CREATED', label: '已创建' },
  { value: 'PICKED', label: '已拣货' },
  { value: 'SHIPPED', label: '已发运' },
  { value: 'IN_TRANSIT', label: '运输中' },
  { value: 'OUT_FOR_DELIVERY', label: '派送中' },
  { value: 'DELIVERED', label: '已签收' },
  { value: 'EXCEPTION', label: '异常' }
]

const shipments = ref<Shipment[]>([])
const selected = ref<Shipment | null>(null)
const timeline = ref<TrackingNode[]>([])
const exceptions = ref<ShipmentException[]>([])
const waves = ref<PickWaveState[]>([])
const loading = ref(false)

const nodeDialog = ref(false)
const nodeForm = ref({ nodeCode: 'IN_TRANSIT', nodeName: '', location: '', operator: '', remark: '' })

const exceptionDialog = ref(false)
const exceptionForm = ref({ exceptionType: 'DAMAGED', description: '', evidence: '' })

function severityTag(severity: string): string {
  return severity === 'HIGH' ? 'danger' : severity === 'MEDIUM' ? 'warning' : 'info'
}

function exceptionLabel(type: string): string {
  return EXCEPTION_TYPES.find((item) => item.value === type)?.label ?? type
}

async function loadShipments(): Promise<void> {
  const result = await fetchShipments({ page: 1, pageSize: 200 })
  shipments.value = result.list
}

async function loadExceptions(): Promise<void> {
  const result = await fetchShipmentExceptions({ page: 1, pageSize: 100 })
  exceptions.value = result.list
}

async function selectShipment(shipment: Shipment): Promise<void> {
  selected.value = shipment
  loading.value = true
  try {
    timeline.value = await fetchShipmentTimeline(shipment.id)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '轨迹加载失败')
  } finally {
    loading.value = false
  }
}

async function saveNode(): Promise<void> {
  if (!selected.value) return
  if (!nodeForm.value.nodeName.trim()) {
    ElMessage.warning('请填写节点名称')
    return
  }
  try {
    await addTrackingNode(selected.value.id, { ...nodeForm.value })
    nodeDialog.value = false
    nodeForm.value = { nodeCode: 'IN_TRANSIT', nodeName: '', location: '', operator: '', remark: '' }
    ElMessage.success('轨迹节点已登记')
    await selectShipment(selected.value)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '登记失败')
  }
}

async function saveException(): Promise<void> {
  if (!selected.value) return
  const evidence = exceptionForm.value.evidence
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  if (evidence.length === 0) {
    ElMessage.warning('异常回单需上传至少一张凭证照片（可填图片地址）')
    return
  }
  try {
    await registerShipmentException(selected.value.id, {
      exceptionType: exceptionForm.value.exceptionType,
      description: exceptionForm.value.description,
      evidenceUrls: evidence
    })
    exceptionDialog.value = false
    exceptionForm.value = { exceptionType: 'DAMAGED', description: '', evidence: '' }
    ElMessage.success('异常回单已登记')
    await loadExceptions()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '登记失败')
  }
}

async function processException(row: ShipmentException, createReturn: boolean): Promise<void> {
  let remark = ''
  try {
    const { value } = await ElMessageBox.prompt('请填写处理说明', '处理异常回单', {
      inputPlaceholder: '如：已联系客户并安排补发',
      inputValidator: (input: string) => (input && input.trim() ? true : '处理说明必填')
    })
    remark = value
  } catch {
    return
  }
  try {
    const result = await handleShipmentException(row.id, { status: 'DONE', handleRemark: remark, createReturn })
    ElMessage.success(createReturn ? `已处理并生成售后退货单 ${result.returnId ?? ''}` : '异常已处理')
    await loadExceptions()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '处理失败')
  }
}

async function bindWave(): Promise<void> {
  if (!selected.value) return
  if (waves.value.length === 0) {
    ElMessage.warning('暂无可关联的已复核波次')
    return
  }
  try {
    const { value } = await ElMessageBox.prompt('请输入拣货波次 ID', '关联拣货波次', {
      inputPlaceholder: waves.value.map((wave) => `${wave.id} ${wave.waveNo}`).join(' / '),
      inputValidator: (input: string) => (Number(input) > 0 ? true : '请输入有效的波次 ID')
    })
    await linkShipmentWave(selected.value.id, Number(value))
    ElMessage.success('波次已关联')
  } catch (cause) {
    if (cause instanceof Error) ElMessage.error(cause.message)
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadShipments(), loadExceptions()])
    waves.value = await fetchShippableWaves()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  }
})
</script>

<template>
  <div class="delivery-page">
    <section class="panel shipment-panel">
      <header class="panel-head">
        <h3>出货单</h3>
        <span class="hint">选择出货单查看轨迹</span>
      </header>
      <el-scrollbar class="shipment-scroll">
        <div
          v-for="item in shipments"
          :key="item.id"
          class="shipment-item"
          :class="{ active: selected?.id === item.id }"
          @click="selectShipment(item)"
        >
          <div class="row-1">
            <span class="no">{{ item.shipmentNo }}</span>
            <el-tag size="small" :type="item.status === 'DONE' ? 'success' : 'info'">{{ item.status }}</el-tag>
          </div>
          <div class="row-2">订单 #{{ item.orderId }} · 客户 #{{ item.customerId }}</div>
          <div class="row-2">运单号 {{ item.trackingNo || '—' }}</div>
        </div>
        <el-empty v-if="shipments.length === 0" description="暂无出货单" :image-size="60" />
      </el-scrollbar>
    </section>

    <section class="panel timeline-panel">
      <header class="panel-head">
        <h3>物流轨迹</h3>
        <div class="actions">
          <el-button size="small" @click="bindWave">关联波次</el-button>
          <el-button size="small" type="primary" :disabled="!selected" @click="nodeDialog = true">登记节点</el-button>
        </div>
      </header>
      <div v-if="selected" class="timeline-meta">
        <span>{{ selected.shipmentNo }}</span>
        <span v-if="selected.signedAt">签收：{{ selected.signedBy }} / {{ selected.signedAt }}</span>
        <span v-else>未签收</span>
      </div>
      <el-timeline v-loading="loading" class="timeline">
        <el-timeline-item
          v-for="node in timeline"
          :key="`${node.nodeTime}-${node.nodeCode}`"
          :type="node.nodeCode === 'EXCEPTION' ? 'danger' : node.isCurrent ? 'primary' : ''"
          :timestamp="node.nodeTime"
          placement="top"
        >
          <div class="node-title">
            {{ node.nodeName }}
            <el-tag v-if="node.isCurrent" size="small" type="primary">当前</el-tag>
          </div>
          <div class="node-desc">
            <span v-if="node.location">地点：{{ node.location }}</span>
            <span v-if="node.operator">经办：{{ node.operator }}</span>
            <span v-if="node.remark">备注：{{ node.remark }}</span>
          </div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-if="selected && timeline.length === 0" description="暂无轨迹节点" :image-size="60" />
    </section>

    <section class="panel exception-panel">
      <header class="panel-head">
        <h3>异常回单</h3>
        <el-button size="small" type="danger" plain :disabled="!selected" @click="exceptionDialog = true">登记异常</el-button>
      </header>
      <div class="exception-list">
        <article v-for="item in exceptions" :key="item.id" class="exception-card">
          <div class="card-head">
            <el-tag size="small" :type="severityTag(item.severity)">{{ exceptionLabel(item.exceptionType) }}</el-tag>
            <el-tag size="small" :type="item.status === 'DONE' ? 'success' : item.status === 'PROCESSING' ? 'warning' : 'info'">{{ item.status }}</el-tag>
          </div>
          <p class="desc">{{ item.description }}</p>
          <div class="card-foot">
            <span>出货单 #{{ item.shipmentId }}</span>
            <span v-if="item.returnId">已转售后 #{{ item.returnId }}</span>
            <span class="spacer" />
            <el-button v-if="item.status !== 'DONE'" size="small" @click="processException(item, false)">处理</el-button>
            <el-button v-if="item.status !== 'DONE' && !item.returnId" size="small" type="warning" @click="processException(item, true)">转售后</el-button>
          </div>
        </article>
        <el-empty v-if="exceptions.length === 0" description="暂无异常回单" :image-size="60" />
      </div>
    </section>

    <el-dialog v-model="nodeDialog" title="登记物流轨迹节点" width="480px">
      <el-form label-width="80px">
        <el-form-item label="节点类型">
          <el-select v-model="nodeForm.nodeCode" style="width: 100%">
            <el-option v-for="item in NODE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="节点名称"><el-input v-model="nodeForm.nodeName" placeholder="如：已到达杭州分拨中心" /></el-form-item>
        <el-form-item label="地点"><el-input v-model="nodeForm.location" /></el-form-item>
        <el-form-item label="经办人"><el-input v-model="nodeForm.operator" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="nodeForm.remark" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="nodeDialog = false">取消</el-button>
        <el-button type="primary" @click="saveNode">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="exceptionDialog" title="登记出货异常回单" width="520px">
      <el-form label-width="80px">
        <el-form-item label="异常类型">
          <el-select v-model="exceptionForm.exceptionType" style="width: 100%">
            <el-option v-for="item in EXCEPTION_TYPES" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="异常描述"><el-input v-model="exceptionForm.description" type="textarea" placeholder="必填，需说明异常经过" /></el-form-item>
        <el-form-item label="凭证照片"><el-input v-model="exceptionForm.evidence" placeholder="必填，多个凭证地址用逗号分隔" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exceptionDialog = false">取消</el-button>
        <el-button type="danger" @click="saveException">登记</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.delivery-page {
  display: grid;
  grid-template-columns: 280px 1fr 340px;
  gap: 12px;
  height: calc(100vh - 132px);
}
.panel {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.panel-head h3 { margin: 0; font-size: 14px; }
.panel-head .hint { font-size: 12px; color: var(--el-text-color-secondary); }
.actions { display: flex; gap: 6px; }
.shipment-scroll { flex: 1; }
.shipment-item {
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  cursor: pointer;
}
.shipment-item:hover { background: var(--el-fill-color-light); }
.shipment-item.active { background: var(--el-color-primary-light-9); }
.row-1 { display: flex; justify-content: space-between; align-items: center; }
.no { font-weight: 600; font-size: 13px; }
.row-2 { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 2px; }
.timeline-panel { padding-bottom: 8px; }
.timeline-meta { display: flex; gap: 16px; padding: 8px 12px; font-size: 12px; color: var(--el-text-color-secondary); }
.timeline { padding: 4px 16px; overflow-y: auto; }
.node-title { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.node-desc { font-size: 12px; color: var(--el-text-color-secondary); display: flex; gap: 12px; margin-top: 2px; }
.exception-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.exception-card { border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 8px 10px; }
.card-head { display: flex; justify-content: space-between; }
.desc { margin: 6px 0; font-size: 12px; line-height: 1.5; }
.card-foot { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--el-text-color-secondary); }
.spacer { flex: 1; }
</style>
