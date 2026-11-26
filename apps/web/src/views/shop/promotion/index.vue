<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createPromotion, fetchPromotions, type ShopPromotion } from '@/api/shop'
import type { PageQuery } from '@/types/contract'

const promotions = ref<ShopPromotion[]>([])
const total = ref(0)
const loading = ref(false)
const dialogVisible = ref(false)
const query = reactive<PageQuery & { status?: string }>({ page: 1, pageSize: 20, status: '' })
const form = reactive({ storeId: 0, promotionCode: '', promotionType: 'DISCOUNT', startTime: '', endTime: '', stockLimit: '0' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchPromotions({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status ? { status: query.status } : {})
    })
    promotions.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载营销活动失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, { storeId: 0, promotionCode: '', promotionType: 'DISCOUNT', startTime: '', endTime: '', stockLimit: '0' })
  dialogVisible.value = true
}

async function handleCreate(): Promise<void> {
  try {
    await createPromotion({ ...form })
    dialogVisible.value = false
    ElMessage.success('营销活动已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '创建失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>营销活动</h2>
      <p>平台促销与库存限额在此维护，活动状态驱动同步策略与价格规则。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.status" placeholder="活动状态" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'shop:promotion:create'" @click="openCreate">新增活动</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="promotions" row-key="id">
        <el-table-column prop="promotionCode" label="活动编码" width="150" />
        <el-table-column prop="storeId" label="店铺 ID" width="100" />
        <el-table-column prop="promotionType" label="活动类型" width="120" />
        <el-table-column prop="startTime" label="开始时间" min-width="170" />
        <el-table-column prop="endTime" label="结束时间" min-width="170" />
        <el-table-column prop="stockLimit" label="库存限额" width="120" />
        <el-table-column prop="status" label="状态" width="100" />
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="dialogVisible" title="新增营销活动" width="540px">
      <el-form label-width="100px">
        <el-form-item label="店铺 ID"><el-input-number v-model="form.storeId" :min="1" /></el-form-item>
        <el-form-item label="活动编码"><el-input v-model="form.promotionCode" /></el-form-item>
        <el-form-item label="活动类型">
          <el-select v-model="form.promotionType">
            <el-option label="折扣" value="DISCOUNT" />
            <el-option label="满减" value="FULL_REDUCE" />
            <el-option label="赠品" value="GIFT" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始时间"><el-date-picker v-model="form.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="YYYY-MM-DD HH:mm:ss"  /></el-form-item>
        <el-form-item label="结束时间"><el-date-picker v-model="form.endTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="YYYY-MM-DD HH:mm:ss"  /></el-form-item>
        <el-form-item label="库存限额"><el-input v-model="form.stockLimit" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
