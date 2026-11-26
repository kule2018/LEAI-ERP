<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createSeckill, fetchSeckills, type ShopSeckill } from '@/api/shop'
import type { PageQuery } from '@/types/contract'

const seckills = ref<ShopSeckill[]>([])
const total = ref(0)
const loading = ref(false)
const dialogVisible = ref(false)
const query = reactive<PageQuery & { status?: string }>({ page: 1, pageSize: 20, status: '' })
const form = reactive({
  storeId: 0,
  seckillCode: '',
  productId: 0,
  variantId: 0,
  basePrice: '0',
  seckillPrice: '0',
  limitPerUser: 1,
  startTime: '',
  endTime: ''
})

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchSeckills({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status ? { status: query.status } : {})
    })
    seckills.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载秒杀活动失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, {
    storeId: 0, seckillCode: '', productId: 0, variantId: 0,
    basePrice: '0', seckillPrice: '0', limitPerUser: 1, startTime: '', endTime: ''
  })
  dialogVisible.value = true
}

async function handleCreate(): Promise<void> {
  try {
    await createSeckill({ ...form })
    dialogVisible.value = false
    ElMessage.success('秒杀活动已创建，请继续设置活动库存')
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
      <h2>秒杀活动</h2>
      <p>按活动时段、秒杀价与每人限购控制订单同步；库存需在活动库存页独立设置。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.status" placeholder="状态" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'shop:promotion:create'" @click="openCreate">新增秒杀</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="seckills" row-key="id">
        <el-table-column prop="seckillCode" label="活动编码" width="150" />
        <el-table-column prop="storeId" label="店铺 ID" width="90" />
        <el-table-column prop="productId" label="商品 ID" width="100" />
        <el-table-column prop="basePrice" label="原价" width="110" />
        <el-table-column prop="seckillPrice" label="秒杀价" width="110" />
        <el-table-column prop="limitPerUser" label="每人限购" width="100" />
        <el-table-column prop="startTime" label="开始" min-width="170" />
        <el-table-column prop="endTime" label="结束" min-width="170" />
        <el-table-column prop="status" label="状态" width="90" />
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="dialogVisible" title="新增秒杀活动" width="560px">
      <el-form label-width="100px">
        <el-form-item label="店铺 ID"><el-input-number v-model="form.storeId" :min="1" /></el-form-item>
        <el-form-item label="活动编码"><el-input v-model="form.seckillCode" /></el-form-item>
        <el-form-item label="商品 ID"><el-input-number v-model="form.productId" :min="1" /></el-form-item>
        <el-form-item label="规格 ID"><el-input-number v-model="form.variantId" :min="0" /></el-form-item>
        <el-form-item label="原价"><el-input v-model="form.basePrice" /></el-form-item>
        <el-form-item label="秒杀价"><el-input v-model="form.seckillPrice" /></el-form-item>
        <el-form-item label="每人限购"><el-input-number v-model="form.limitPerUser" :min="1" /></el-form-item>
        <el-form-item label="开始时间"><el-date-picker v-model="form.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="YYYY-MM-DD HH:mm:ss"  /></el-form-item>
        <el-form-item label="结束时间"><el-date-picker v-model="form.endTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="YYYY-MM-DD HH:mm:ss"  /></el-form-item>
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
