<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchTracking, fetchWaybills, generateWaybill, markWaybillException, pushTracking,
  type ShopWaybill, type TrackingEvent
} from '@/api/shop'
import type { PageQuery } from '@/types/contract'

const waybills = ref<ShopWaybill[]>([])
const total = ref(0)
const loading = ref(false)
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const trackingVisible = ref(false)
const trackingRows = ref<TrackingEvent[]>([])
const currentWaybillId = ref(0)
const trackingForm = reactive({ status: 'IN_TRANSIT', location: '', description: '', eventAt: '' })
const labelForm = reactive({ orderId: 0, carrier: 'SF' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchWaybills(query)
    waybills.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载运单失败')
  } finally {
    loading.value = false
  }
}

async function markException(id: number): Promise<void> {
  try {
    await markWaybillException(id)
    ElMessage.success('运单已标记为异常')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '标记失败')
  }
}

async function handleGenerateLabel(): Promise<void> {
  try {
    await generateWaybill(labelForm.orderId, labelForm.carrier)
    ElMessage.success('电子面单已生成')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '生成失败')
  }
}

async function openTracking(id: number): Promise<void> {
  currentWaybillId.value = id
  trackingRows.value = await fetchTracking(id)
  trackingVisible.value = true
}

async function handlePush(): Promise<void> {
  try {
    const result = await pushTracking(currentWaybillId.value, { ...trackingForm })
    if (result.exception.exception) ElMessage.warning(result.exception.reason ?? '物流轨迹异常')
    else ElMessage.success('轨迹已更新')
    trackingRows.value = await fetchTracking(currentWaybillId.value)
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '推送失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>物流运单</h2>
      <p>运单与商城订单绑定，异常标记会写入同步日志并进入异常检测范围。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索运单号" clearable @keyup.enter="load" />
        <el-input-number v-model="labelForm.orderId" :min="1" placeholder="商城订单 ID" />
        <el-select v-model="labelForm.carrier" style="width: 120px">
          <el-option label="顺丰" value="SF" />
          <el-option label="圆通" value="YT" />
          <el-option label="中通" value="ZTO" />
          <el-option label="京东" value="JD" />
        </el-select>
        <el-button v-perm="'shop:order:ship'" @click="handleGenerateLabel">生成面单</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="waybills" row-key="id">
        <el-table-column prop="waybillNo" label="运单号" min-width="180" />
        <el-table-column prop="shopOrderId" label="商城订单 ID" width="130" />
        <el-table-column prop="carrier" label="承运商" width="120" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="exceptionFlag" label="异常标记" width="100" />
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'shop:logistics:view'" @click="openTracking(Number(row.id))">轨迹</el-button>
            <el-button link type="danger" v-perm="'shop:logistics:update'" :disabled="row.exceptionFlag === 'YES'" @click="markException(Number(row.id))">标记异常</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="trackingVisible" title="物流轨迹" width="620px">
      <el-form label-width="80px">
        <el-form-item label="状态"><el-input v-model="trackingForm.status" /></el-form-item>
        <el-form-item label="地点"><el-input v-model="trackingForm.location" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="trackingForm.description" /></el-form-item>
      </el-form>
      <el-button type="primary" v-perm="'shop:logistics:update'" @click="handlePush">推送轨迹</el-button>
      <el-table :data="trackingRows" size="small" style="margin-top: 12px">
        <el-table-column prop="carrierStatus" label="状态" width="120" />
        <el-table-column prop="location" label="地点" min-width="150" />
        <el-table-column prop="description" label="说明" min-width="180" />
        <el-table-column prop="eventAt" label="时间" min-width="170" />
      </el-table>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
