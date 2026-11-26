<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createAgreement, fetchAgreements, type PriceAgreement } from '@/api/sales'
import type { PageQuery } from '@/types/contract'

const rows = ref<PriceAgreement[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const dialogVisible = ref(false)
const form = reactive({ customerId: 0, productId: 0, categoryId: 0, price: '0', qtyStep: '1', startDate: '', endDate: '' })
let requestSeq = 0

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchAgreements(query.value)
    if (seq !== requestSeq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function openAdd(): void {
  form.customerId = 0
  form.productId = 0
  form.categoryId = 0
  form.price = '0'
  form.qtyStep = '1'
  form.startDate = ''
  form.endDate = ''
  dialogVisible.value = true
}

async function save(): Promise<void> {
  try {
    await createAgreement({
      customerId: form.customerId,
      productId: form.productId || undefined,
      categoryId: form.categoryId || undefined,
      price: form.price,
      qtyStep: form.qtyStep,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined
    })
    dialogVisible.value = false
    ElMessage.success('协议已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

onMounted(load)
onUnmounted(() => { requestSeq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>销售价格协议</h2>
      <p>按客户、产品或品类维护阶梯价和有效期；开单时协议价优先于标准价。</p>
    </header>
    <article class="panel">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索产品ID" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'sales:price:create'" @click="openAdd">新增协议</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <div v-if="error" class="error">{{ error }}</div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="customerId" label="客户ID" width="110" />
        <el-table-column prop="productId" label="产品ID" width="110" />
        <el-table-column prop="categoryId" label="品类ID" width="110" />
        <el-table-column prop="price" label="协议价" width="130" />
        <el-table-column prop="qtyStep" label="数量阶梯" width="120" />
        <el-table-column prop="startDate" label="生效日" width="120" />
        <el-table-column prop="endDate" label="到期日" width="120" />
        <el-table-column prop="status" label="状态" width="100" />
      </el-table>
    </article>
    <el-dialog v-model="dialogVisible" title="新增价格协议" width="560px">
      <el-form label-width="90px">
        <el-form-item label="客户ID"><el-input-number v-model="form.customerId" :min="1" /></el-form-item>
        <el-form-item label="产品ID"><el-input-number v-model="form.productId" :min="0" /></el-form-item>
        <el-form-item label="品类ID"><el-input-number v-model="form.categoryId" :min="0" /></el-form-item>
        <el-form-item label="协议价"><el-input v-model="form.price" /></el-form-item>
        <el-form-item label="数量阶梯"><el-input v-model="form.qtyStep" /></el-form-item>
        <el-form-item label="生效日"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="到期日"><el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.error { color: #f5222d; margin-bottom: 12px; }
</style>
