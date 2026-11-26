<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchAvailableStock,
  fetchBatchLocationMatrix,
  receiveTransfer,
  scanStocktake,
  type AvailableStockRow,
  type MatrixRow
} from '@/api/ops-enhancement'

const available = ref<AvailableStockRow[]>([])
const matrix = ref<MatrixRow[]>([])
const query = reactive({ warehouseId: undefined as number | undefined, productId: undefined as number | undefined })
const scanForm = reactive({
  stocktakeId: 0,
  barcode: '',
  productId: undefined as number | undefined,
  batchNo: '',
  qty: '1'
})
const scanLogs = ref<Array<{ barcode: string; qty: string; message: string }>>([])
const receiptForm = reactive({ transferId: 0, lineId: 0, receivedQty: '0', remark: '' })

function fail(cause: unknown): void {
  ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
}

async function loadAvailable(): Promise<void> {
  try {
    available.value = await fetchAvailableStock({ warehouseId: query.warehouseId, productId: query.productId })
  } catch (cause) {
    fail(cause)
  }
}

async function loadMatrix(): Promise<void> {
  try {
    matrix.value = await fetchBatchLocationMatrix({ warehouseId: query.warehouseId, productId: query.productId })
  } catch (cause) {
    fail(cause)
  }
}

async function handleScan(): Promise<void> {
  if (!scanForm.stocktakeId) {
    ElMessage.warning('请填写盘点单ID')
    return
  }
  try {
    const result = await scanStocktake(scanForm.stocktakeId, [
      {
        barcode: scanForm.barcode || undefined,
        productId: scanForm.barcode ? undefined : scanForm.productId,
        batchNo: scanForm.batchNo || undefined,
        qty: scanForm.qty
      }
    ])
    scanLogs.value.unshift({
      barcode: scanForm.barcode || `产品#${scanForm.productId ?? '-'}`,
      qty: scanForm.qty,
      message: `已扫码 ${result.result.scannedCount} 条，累计 ${result.result.scannedQty}${result.result.blindMode ? '（盲盘）' : ''}`
    })
    ElMessage.success(scanLogs.value[0].message)
    scanForm.qty = '1'
  } catch (cause) {
    fail(cause)
  }
}

async function handleReceive(): Promise<void> {
  if (!receiptForm.transferId || !receiptForm.lineId) {
    ElMessage.warning('请填写调拨单ID与明细ID')
    return
  }
  try {
    await receiveTransfer(receiptForm.transferId, [{ lineId: receiptForm.lineId, receivedQty: receiptForm.receivedQty }], receiptForm.remark)
    ElMessage.success('签收完成，差异已记录')
  } catch (cause) {
    fail(cause)
  }
}

onMounted(() => {
  void loadAvailable()
  void loadMatrix()
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>库存作业增强</h2>
      <p>可用量（实物 - 锁定 - 冻结）、批次×库位矩阵、扫码实盘（支持盲盘）与调拨签收差异登记。</p>
    </header>

    <el-tabs>
      <el-tab-pane label="可用量" name="available">
        <div class="toolbar">
          <el-input-number v-model="query.warehouseId" :min="1" placeholder="仓库ID" controls-position="right" style="width: 150px" />
          <el-input-number v-model="query.productId" :min="1" placeholder="产品ID" controls-position="right" style="width: 150px" />
          <el-button type="primary" @click="loadAvailable">查询</el-button>
        </div>
        <el-table :data="available" size="small">
          <el-table-column prop="productId" label="产品ID" width="100" />
          <el-table-column prop="variantId" label="变体ID" width="100" />
          <el-table-column prop="warehouseId" label="仓库ID" width="100" />
          <el-table-column prop="locationId" label="库位ID" width="100" />
          <el-table-column prop="batchNo" label="批次号" width="140" />
          <el-table-column prop="qtyOnHand" label="实物量" width="110" />
          <el-table-column prop="qtyOccupied" label="锁定量" width="110" />
          <el-table-column prop="qtyFrozen" label="冻结量" width="110" />
          <el-table-column prop="qtyAvailable" label="可用量" width="110" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="批次×库位矩阵" name="matrix">
        <div class="toolbar">
          <el-input-number v-model="query.warehouseId" :min="1" placeholder="仓库ID" controls-position="right" style="width: 150px" />
          <el-input-number v-model="query.productId" :min="1" placeholder="产品ID" controls-position="right" style="width: 150px" />
          <el-button type="primary" @click="loadMatrix">查询</el-button>
        </div>
        <el-table :data="matrix" size="small">
          <el-table-column prop="productId" label="产品ID" width="100" />
          <el-table-column prop="warehouseId" label="仓库ID" width="100" />
          <el-table-column prop="totalOnHand" label="实物合计" width="120" />
          <el-table-column prop="totalOccupied" label="锁定合计" width="120" />
          <el-table-column prop="totalFrozen" label="冻结合计" width="120" />
          <el-table-column prop="totalAvailable" label="可用合计" width="120" />
          <el-table-column label="批次明细" min-width="280">
            <template #default="{ row }">
              <el-tag
                v-for="cell in row.cells"
                :key="`${cell.locationId}-${cell.batchNo}`"
                size="small"
                type="info"
                class="cell-tag"
              >
                库位{{ cell.locationId }} / {{ cell.batchNo || '无批次' }}：{{ cell.qtyAvailable }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="扫码实盘" name="scan">
        <el-form :inline="true">
          <el-form-item label="盘点单ID">
            <el-input-number v-model="scanForm.stocktakeId" :min="1" />
          </el-form-item>
          <el-form-item label="条码">
            <el-input v-model="scanForm.barcode" style="width: 180px" placeholder="扫码枪输入" />
          </el-form-item>
          <el-form-item label="产品ID">
            <el-input-number v-model="scanForm.productId" :min="1" />
          </el-form-item>
          <el-form-item label="批次号">
            <el-input v-model="scanForm.batchNo" style="width: 140px" />
          </el-form-item>
          <el-form-item label="数量">
            <el-input v-model="scanForm.qty" style="width: 100px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" v-perm="'inventory:stocktake:create'" @click="handleScan">扫码录入</el-button>
          </el-form-item>
        </el-form>
        <el-table :data="scanLogs" size="small">
          <el-table-column prop="barcode" label="条码/产品" min-width="180" />
          <el-table-column prop="qty" label="数量" width="100" />
          <el-table-column prop="message" label="结果" min-width="260" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="调拨签收" name="receipt">
        <el-form :inline="true">
          <el-form-item label="调拨单ID">
            <el-input-number v-model="receiptForm.transferId" :min="1" />
          </el-form-item>
          <el-form-item label="明细ID">
            <el-input-number v-model="receiptForm.lineId" :min="1" />
          </el-form-item>
          <el-form-item label="实收数量">
            <el-input v-model="receiptForm.receivedQty" style="width: 120px" />
          </el-form-item>
          <el-form-item label="差异说明">
            <el-input v-model="receiptForm.remark" style="width: 220px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" v-perm="'inventory:transfer:receive'" @click="handleReceive">提交签收</el-button>
          </el-form-item>
        </el-form>
        <p class="tip">签收数量超过调拨数量将被拒绝；少于调拨数量按差异登记并生成调拨差异。</p>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.cell-tag {
  margin: 2px 6px 2px 0;
}

.tip {
  color: #909399;
  font-size: 13px;
}
</style>
