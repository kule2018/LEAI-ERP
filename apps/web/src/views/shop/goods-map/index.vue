<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createGoodsMap, fetchGoodsMaps, retryFailedGoodsMaps, syncGoodsMap, type ShopGoodsMap
} from '@/api/shop'
import type { PageQuery } from '@/types/contract'

const maps = ref<ShopGoodsMap[]>([])
const total = ref(0)
const loading = ref(false)
const dialogVisible = ref(false)
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const form = reactive({ storeId: 0, platformGoodsId: '', platformSkuId: '', productId: 0, variantId: 0, priceRule: '', stockRule: '' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchGoodsMaps(query)
    maps.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载商品映射失败')
  } finally {
    loading.value = false
  }
}

async function handleSync(id: number): Promise<void> {
  try {
    const result = await syncGoodsMap(id)
    ElMessage.success(result.syncStatus === 'SUCCESS' ? '同步成功' : result.errorText ?? '同步失败')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '同步失败')
  }
}

async function handleRetryFailed(): Promise<void> {
  try {
    const count = await retryFailedGoodsMaps()
    ElMessage.success(`已重试 ${count} 条失败映射`)
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '重试失败')
  }
}

function openCreate(): void {
  Object.assign(form, { storeId: 0, platformGoodsId: '', platformSkuId: '', productId: 0, variantId: 0, priceRule: '', stockRule: '' })
  dialogVisible.value = true
}

async function handleCreate(): Promise<void> {
  try {
    await createGoodsMap({ ...form })
    dialogVisible.value = false
    ElMessage.success('商品映射已创建')
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
      <h2>商品映射</h2>
      <p>平台商品与 ERP 产品/SKU 一对一映射，价格与库存规则按店铺差异配置。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索平台商品 ID" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'shop:goods:create'" @click="openCreate">新增映射</el-button>
        <el-button v-perm="'shop:goods:update'" @click="handleRetryFailed">重试失败</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="maps" row-key="id">
        <el-table-column prop="storeId" label="店铺 ID" width="100" />
        <el-table-column prop="platformGoodsId" label="平台商品" min-width="150" />
        <el-table-column prop="platformSkuId" label="平台 SKU" width="140" />
        <el-table-column prop="productId" label="产品 ID" width="100" />
        <el-table-column prop="variantId" label="SKU ID" width="100" />
        <el-table-column prop="priceRule" label="价格规则" min-width="140" />
        <el-table-column prop="stockRule" label="库存规则" min-width="140" />
        <el-table-column prop="status" label="状态" width="90" />
        <el-table-column prop="syncStatus" label="同步状态" width="110" />
        <el-table-column prop="errorText" label="失败原因" min-width="150" />
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'shop:goods:update'" @click="handleSync(Number(row.id))">同步</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="dialogVisible" title="新增商品映射" width="560px">
      <el-form label-width="110px">
        <el-form-item label="店铺 ID"><el-input-number v-model="form.storeId" :min="1" /></el-form-item>
        <el-form-item label="平台商品 ID"><el-input v-model="form.platformGoodsId" /></el-form-item>
        <el-form-item label="平台 SKU ID"><el-input v-model="form.platformSkuId" /></el-form-item>
        <el-form-item label="ERP 产品 ID"><el-input-number v-model="form.productId" :min="1" /></el-form-item>
        <el-form-item label="ERP SKU ID"><el-input-number v-model="form.variantId" :min="0" /></el-form-item>
        <el-form-item label="价格规则"><el-input v-model="form.priceRule" placeholder="例如：售价=协议价*1.05" /></el-form-item>
        <el-form-item label="库存规则"><el-input v-model="form.stockRule" placeholder="例如：同步可用量" /></el-form-item>
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
