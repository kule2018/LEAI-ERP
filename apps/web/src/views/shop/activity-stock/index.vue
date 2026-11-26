<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchActivityStocks, releaseActivityStock, reserveActivityStock, setActivityStock,
  type ShopActivityStock
} from '@/api/shop'
import type { PageQuery } from '@/types/contract'

const rows = ref<ShopActivityStock[]>([])
const total = ref(0)
const loading = ref(false)
const settingVisible = ref(false)
const reserveVisible = ref(false)
const reserveResult = ref('')
const query = reactive<PageQuery & { status?: string }>({ page: 1, pageSize: 20, status: '' })
const form = reactive({
  storeId: 0,
  activityType: 'SECKILL',
  activityId: 0,
  productId: 0,
  variantId: 0,
  totalStock: '0'
})
const reserveForm = reactive({
  storeId: 0,
  activityType: 'SECKILL',
  activityId: 0,
  productId: 0,
  variantId: 0,
  qty: '1',
  buyerKey: ''
})

function available(row: ShopActivityStock): string {
  return (Number(row.totalStock) - Number(row.soldStock) - Number(row.lockedStock)).toFixed(3)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchActivityStocks({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status ? { status: query.status } : {})
    })
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载活动库存失败')
  } finally {
    loading.value = false
  }
}

function openSetting(): void {
  Object.assign(form, { storeId: 0, activityType: 'SECKILL', activityId: 0, productId: 0, variantId: 0, totalStock: '0' })
  settingVisible.value = true
}

function openReserve(row: ShopActivityStock): void {
  Object.assign(reserveForm, {
    storeId: row.storeId,
    activityType: row.activityType,
    activityId: row.activityId,
    productId: row.productId,
    variantId: row.variantId,
    qty: '1',
    buyerKey: ''
  })
  reserveResult.value = ''
  reserveVisible.value = true
}

async function handleSet(): Promise<void> {
  try {
    await setActivityStock({ ...form })
    settingVisible.value = false
    ElMessage.success('活动库存已设置')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '设置失败')
  }
}

async function handleReserve(): Promise<void> {
  try {
    const result = await reserveActivityStock({ ...reserveForm })
    reserveResult.value = `预留成功，成交单价 ${result.price}，活动订单 ${result.orderId}`
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '预留失败')
  }
}

async function handleRelease(id: number): Promise<void> {
  try {
    await releaseActivityStock(id)
    ElMessage.success('活动库存已释放')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '释放失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>活动库存</h2>
      <p>优惠券与秒杀共用独立活动库存池；预留采用行锁与可用量校验，库存为零时直接拒绝超卖。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.status" placeholder="状态" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'shop:promotion:stock'" @click="openSetting">设置活动库存</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="storeId" label="店铺 ID" width="90" />
        <el-table-column prop="activityType" label="活动类型" width="110" />
        <el-table-column prop="activityId" label="活动 ID" width="100" />
        <el-table-column prop="productId" label="商品 ID" width="100" />
        <el-table-column prop="variantId" label="规格 ID" width="100" />
        <el-table-column prop="totalStock" label="总量" width="100" />
        <el-table-column prop="soldStock" label="已确认" width="100" />
        <el-table-column prop="lockedStock" label="锁定" width="100" />
        <el-table-column label="可用" width="100">
          <template #default="{ row }">{{ available(row) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'shop:promotion:stock'" @click="openReserve(row)">预留</el-button>
            <el-button link type="warning" v-perm="'shop:promotion:stock'" @click="handleRelease(row.id)">释放</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="settingVisible" title="设置活动库存" width="520px">
      <el-form label-width="100px">
        <el-form-item label="店铺 ID"><el-input-number v-model="form.storeId" :min="1" /></el-form-item>
        <el-form-item label="活动类型">
          <el-select v-model="form.activityType">
            <el-option label="秒杀" value="SECKILL" />
            <el-option label="营销" value="PROMOTION" />
          </el-select>
        </el-form-item>
        <el-form-item label="活动 ID"><el-input-number v-model="form.activityId" :min="1" /></el-form-item>
        <el-form-item label="商品 ID"><el-input-number v-model="form.productId" :min="1" /></el-form-item>
        <el-form-item label="规格 ID"><el-input-number v-model="form.variantId" :min="0" /></el-form-item>
        <el-form-item label="活动库存"><el-input v-model="form.totalStock" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="settingVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSet">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reserveVisible" title="预留活动库存" width="480px">
      <el-form label-width="100px">
        <el-form-item label="数量"><el-input v-model="reserveForm.qty" /></el-form-item>
        <el-form-item label="买家标识"><el-input v-model="reserveForm.buyerKey" placeholder="留空则按匿名用户限购" /></el-form-item>
      </el-form>
      <div v-if="reserveResult" class="result">{{ reserveResult }}</div>
      <template #footer>
        <el-button @click="reserveVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleReserve">预留</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.result { padding: 10px; color: #237804; background: #f6ffed; border-radius: 6px; }
</style>
