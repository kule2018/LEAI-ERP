<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createCoupon, fetchCoupons, validateCoupon, type ShopCoupon } from '@/api/shop'
import type { PageQuery } from '@/types/contract'

const coupons = ref<ShopCoupon[]>([])
const total = ref(0)
const loading = ref(false)
const dialogVisible = ref(false)
const validateVisible = ref(false)
const validation = ref<{ valid: boolean; discount: number; reason?: string } | null>(null)
const query = reactive<PageQuery & { status?: string }>({ page: 1, pageSize: 20, status: '' })
const form = reactive({
  storeId: 0,
  couponCode: '',
  couponType: 'FIXED',
  discountValue: '0',
  minAmount: '0',
  maxDiscount: '0',
  startTime: '',
  endTime: '',
  stackable: false
})
const validateForm = reactive({ storeId: 0, couponCode: '', amount: '0' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchCoupons({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status ? { status: query.status } : {})
    })
    coupons.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载优惠券失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, {
    storeId: 0, couponCode: '', couponType: 'FIXED', discountValue: '0',
    minAmount: '0', maxDiscount: '0', startTime: '', endTime: '', stackable: false
  })
  dialogVisible.value = true
}

async function handleCreate(): Promise<void> {
  try {
    await createCoupon({ ...form })
    dialogVisible.value = false
    ElMessage.success('优惠券已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '创建失败')
  }
}

async function handleValidate(): Promise<void> {
  try {
    validation.value = await validateCoupon({ ...validateForm })
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '校验失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>优惠券</h2>
      <p>支持满减门槛、百分比折扣、叠加策略与折扣上限，订单同步时自动计算优惠。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.status" placeholder="状态" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'shop:promotion:create'" @click="openCreate">新增优惠券</el-button>
        <el-button @click="validateVisible = true">校验优惠券</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="coupons" row-key="id">
        <el-table-column prop="couponCode" label="券码" width="150" />
        <el-table-column prop="storeId" label="店铺 ID" width="90" />
        <el-table-column prop="couponType" label="类型" width="100" />
        <el-table-column prop="discountValue" label="优惠值" width="110" />
        <el-table-column prop="minAmount" label="门槛" width="110" />
        <el-table-column prop="maxDiscount" label="上限" width="110" />
        <el-table-column prop="usedCount" label="已用次数" width="100" />
        <el-table-column prop="startTime" label="开始" min-width="170" />
        <el-table-column prop="endTime" label="结束" min-width="170" />
        <el-table-column prop="status" label="状态" width="90" />
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="dialogVisible" title="新增优惠券" width="560px">
      <el-form label-width="100px">
        <el-form-item label="店铺 ID"><el-input-number v-model="form.storeId" :min="1" /></el-form-item>
        <el-form-item label="券码"><el-input v-model="form.couponCode" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.couponType">
            <el-option label="固定金额" value="FIXED" />
            <el-option label="百分比" value="PERCENT" />
          </el-select>
        </el-form-item>
        <el-form-item label="优惠值"><el-input v-model="form.discountValue" /></el-form-item>
        <el-form-item label="使用门槛"><el-input v-model="form.minAmount" /></el-form-item>
        <el-form-item label="优惠上限"><el-input v-model="form.maxDiscount" /></el-form-item>
        <el-form-item label="开始时间"><el-date-picker v-model="form.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="YYYY-MM-DD HH:mm:ss"  /></el-form-item>
        <el-form-item label="结束时间"><el-date-picker v-model="form.endTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="YYYY-MM-DD HH:mm:ss"  /></el-form-item>
        <el-form-item label="允许叠加"><el-switch v-model="form.stackable" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="validateVisible" title="校验优惠券" width="480px">
      <el-form label-width="90px">
        <el-form-item label="店铺 ID"><el-input-number v-model="validateForm.storeId" :min="1" /></el-form-item>
        <el-form-item label="券码"><el-input v-model="validateForm.couponCode" /></el-form-item>
        <el-form-item label="订单金额"><el-input v-model="validateForm.amount" /></el-form-item>
      </el-form>
      <div v-if="validation" class="validation" :class="validation.valid ? 'ok' : 'bad'">
        {{ validation.valid ? `可优惠 ${validation.discount}` : validation.reason }}
      </div>
      <template #footer>
        <el-button @click="validateVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleValidate">校验</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.validation { margin-top: 12px; padding: 10px; border-radius: 6px; }
.validation.ok { color: #237804; background: #f6ffed; }
.validation.bad { color: #a8071a; background: #fff1f0; }
</style>
