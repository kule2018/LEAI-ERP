<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { checkStoreHealth, createStore, fetchStores, type ShopStore } from '@/api/shop'
import type { PageQuery } from '@/types/contract'

const stores = ref<ShopStore[]>([])
const total = ref(0)
const loading = ref(false)
const dialogVisible = ref(false)
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const form = reactive({ storeCode: '', storeName: '', platform: 'TAOBAO', secret: '', syncStrategy: 'MANUAL' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchStores(query)
    stores.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载店铺失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, { storeCode: '', storeName: '', platform: 'TAOBAO', secret: '', syncStrategy: 'MANUAL' })
  dialogVisible.value = true
}

async function handleCreate(): Promise<void> {
  try {
    await createStore({ ...form })
    dialogVisible.value = false
    ElMessage.success('店铺已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '创建失败')
  }
}

async function checkHealth(id: number): Promise<void> {
  try {
    await checkStoreHealth(id)
    ElMessage.success('健康检查完成')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '检查失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>店铺配置</h2>
      <p>统一维护第三方平台店铺、授权状态与同步策略，密钥仅保存脱敏信息。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索店铺编码或名称" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'shop:store:create'" @click="openCreate">新增店铺</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="stores" row-key="id">
        <el-table-column prop="storeCode" label="店铺编码" width="150" />
        <el-table-column prop="storeName" label="店铺名称" min-width="160" />
        <el-table-column prop="platform" label="平台" width="110" />
        <el-table-column prop="healthStatus" label="健康状态" width="120" />
        <el-table-column prop="syncStrategy" label="同步策略" width="110" />
        <el-table-column prop="status" label="状态" width="90" />
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'shop:store:update'" @click="checkHealth(Number(row.id))">健康检查</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="dialogVisible" title="新增店铺" width="520px">
      <el-form label-width="100px">
        <el-form-item label="店铺编码"><el-input v-model="form.storeCode" /></el-form-item>
        <el-form-item label="店铺名称"><el-input v-model="form.storeName" /></el-form-item>
        <el-form-item label="平台">
          <el-select v-model="form.platform">
            <el-option label="淘宝" value="TAOBAO" />
            <el-option label="京东" value="JD" />
            <el-option label="抖音" value="DOUYIN" />
            <el-option label="小程序" value="MINIAPP" />
          </el-select>
        </el-form-item>
        <el-form-item label="同步策略">
          <el-select v-model="form.syncStrategy">
            <el-option label="手动" value="MANUAL" />
            <el-option label="定时" value="SCHEDULE" />
            <el-option label="实时" value="REALTIME" />
          </el-select>
        </el-form-item>
        <el-form-item label="授权密钥"><el-input v-model="form.secret" type="password" show-password /></el-form-item>
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
