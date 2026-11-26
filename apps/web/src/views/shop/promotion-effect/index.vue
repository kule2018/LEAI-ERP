<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchActivityCalendar, fetchPromotionEffect, type PromotionEffect } from '@/api/shop'

const storeId = ref<number | undefined>(undefined)
const effect = ref<PromotionEffect | null>(null)
const calendar = ref<Array<{ date: string; activities: Array<{ code: string; start: string; end: string }> }>>([])
const loading = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    const [effectResult, calendarResult] = await Promise.all([
      fetchPromotionEffect(storeId.value),
      fetchActivityCalendar()
    ])
    effect.value = effectResult
    calendar.value = calendarResult
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载促销效果失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container" v-loading="loading">
    <header class="page-header">
      <h2>促销效果</h2>
      <p>统计优惠券使用、秒杀参与、活动库存流转与超卖拦截次数，用于活动复盘。</p>
    </header>

    <div class="toolbar">
      <el-input-number v-model="storeId" :min="1" placeholder="店铺 ID（全部留空）" />
      <el-button type="primary" @click="load">查询</el-button>
    </div>

    <div class="stat-grid">
      <article class="stat-card"><span>优惠券数量</span><strong>{{ effect?.couponCount ?? 0 }}</strong></article>
      <article class="stat-card"><span>优惠券使用次数</span><strong>{{ effect?.couponUsedCount ?? 0 }}</strong></article>
      <article class="stat-card"><span>秒杀活动</span><strong>{{ effect?.seckillCount ?? 0 }}</strong></article>
      <article class="stat-card"><span>活动库存 SKU</span><strong>{{ effect?.activityStockCount ?? 0 }}</strong></article>
      <article class="stat-card"><span>活动库存总量</span><strong>{{ effect?.totalActivityStock ?? '0' }}</strong></article>
      <article class="stat-card"><span>锁定数量</span><strong>{{ effect?.reservedQty ?? '0' }}</strong></article>
      <article class="stat-card"><span>确认销量</span><strong>{{ effect?.soldQty ?? '0' }}</strong></article>
      <article class="stat-card"><span>释放数量</span><strong>{{ effect?.releasedQty ?? '0' }}</strong></article>
      <article class="stat-card"><span>优惠金额</span><strong>{{ effect?.discountAmount ?? '0' }}</strong></article>
      <article class="stat-card danger"><span>超卖拦截</span><strong>{{ effect?.oversellBlockedCount ?? 0 }}</strong></article>
    </div>

    <article class="panel">
      <h3>活动日历</h3>
      <el-table :data="calendar" size="small">
        <el-table-column prop="date" label="日期" width="130" />
        <el-table-column label="活动">
          <template #default="{ row }">
            <el-tag v-for="item in row.activities" :key="item.code" style="margin-right: 8px">{{ item.code }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </article>
  </section>
</template>

<style scoped>
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.panel { margin-top: 16px; padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin: 0 0 12px; font-size: 15px; }
.stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
.stat-card { padding: 16px; background: #fff; border-radius: 8px; }
.stat-card span { display: block; color: #8c8c8c; font-size: 12px; }
.stat-card strong { display: block; margin-top: 6px; font-size: 22px; }
.stat-card.danger strong { color: #f5222d; }
</style>
