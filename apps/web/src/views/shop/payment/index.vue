<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createPaymentConfig, fetchPaymentConfigs, reconcilePayment, type ShopPaymentConfig } from '@/api/shop'
import type { PageQuery } from '@/types/contract'

const configs = ref<ShopPaymentConfig[]>([])
const total = ref(0)
const loading = ref(false)
const createVisible = ref(false)
const reconcileVisible = ref(false)
const currentStoreId = ref(0)
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const form = reactive({ storeId: 0, channel: 'WECHAT', merchantId: '', secret: '' })
const reconcileForm = reactive({ result: 'SUCCESS' as 'SUCCESS' | 'DIFF' | 'PENDING', note: '' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchPaymentConfigs(query)
    configs.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载支付配置失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, { storeId: 0, channel: 'WECHAT', merchantId: '', secret: '' })
  createVisible.value = true
}

async function handleCreate(): Promise<void> {
  try {
    await createPaymentConfig({ ...form })
    createVisible.value = false
    ElMessage.success('支付配置已保存')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

function openReconcile(storeId: number): void {
  currentStoreId.value = storeId
  reconcileForm.result = 'SUCCESS'
  reconcileForm.note = ''
  reconcileVisible.value = true
}

async function handleReconcile(): Promise<void> {
  try {
    await reconcilePayment(currentStoreId.value, { ...reconcileForm })
    reconcileVisible.value = false
    ElMessage.success('对账结果已记录')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '对账失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>支付配置</h2>
      <p>支付渠道密钥脱敏存储，对账结果写入同步日志供审计追踪。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索商户号" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'shop:payment:create'" @click="openCreate">新增配置</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="configs" row-key="id">
        <el-table-column prop="storeId" label="店铺 ID" width="100" />
        <el-table-column prop="channel" label="渠道" width="120" />
        <el-table-column prop="merchantId" label="商户号" min-width="160" />
        <el-table-column prop="secretMask" label="密钥" min-width="160" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'shop:payment:reconcile'" @click="openReconcile(Number(row.storeId))">对账</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="createVisible" title="新增支付配置" width="480px">
      <el-form label-width="100px">
        <el-form-item label="店铺 ID"><el-input-number v-model="form.storeId" :min="1" /></el-form-item>
        <el-form-item label="渠道">
          <el-select v-model="form.channel">
            <el-option label="微信" value="WECHAT" />
            <el-option label="支付宝" value="ALIPAY" />
            <el-option label="银联" value="UNIONPAY" />
          </el-select>
        </el-form-item>
        <el-form-item label="商户号"><el-input v-model="form.merchantId" /></el-form-item>
        <el-form-item label="密钥"><el-input v-model="form.secret" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reconcileVisible" title="记录对账结果" width="460px">
      <el-form label-width="90px">
        <el-form-item label="结果">
          <el-select v-model="reconcileForm.result">
            <el-option label="一致" value="SUCCESS" />
            <el-option label="有差异" value="DIFF" />
            <el-option label="待确认" value="PENDING" />
          </el-select>
        </el-form-item>
        <el-form-item label="说明"><el-input v-model="reconcileForm.note" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reconcileVisible = false">取消</el-button>
        <el-button type="primary" @click="handleReconcile">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
