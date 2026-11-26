<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createOutsourceOrder,
  fetchOutsourceDetail,
  fetchOutsourceOrders,
  issueOutsourceMaterial,
  receiveOutsource,
  setOutsourceStatus,
  type OutsourceOrder,
  type OutsourceOrderLine
} from '@/api/purchase'
import type { PageQuery } from '@/types/contract'

interface MaterialForm { materialId: number; qty: string }

const orders = ref<OutsourceOrder[]>([])
const lines = ref<OutsourceOrderLine[]>([])
const current = ref<OutsourceOrder | null>(null)
const total = ref(0)
const loading = ref(false)
const createVisible = ref(false)
const issueVisible = ref(false)
const receiveVisible = ref(false)
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const form = reactive({ supplierId: 0, productId: 0, warehouseId: 0, qty: '1', unitPrice: '0', remark: '', materials: [{ materialId: 0, qty: '1' }] as MaterialForm[] })
const issueForm = reactive({ issueType: 'PICK', materialId: 0, qty: '1', batchNo: '' })
const receiveForm = reactive({ qty: '1', batchNo: '' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchOutsourceOrders(query)
    orders.value = result.list
    total.value = result.total
    if (orders.value.length) await selectOrder(orders.value[0]?.id ?? 0)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载委外单失败')
  } finally {
    loading.value = false
  }
}

async function selectOrder(id: number): Promise<void> {
  if (!id) return
  try {
    const detail = await fetchOutsourceDetail(id)
    current.value = detail.order
    lines.value = detail.lines
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载明细失败')
  }
}

function openCreate(): void {
  Object.assign(form, {
    supplierId: 0, productId: 0, warehouseId: 0, qty: '1', unitPrice: '0', remark: '',
    materials: [{ materialId: 0, qty: '1' }]
  })
  createVisible.value = true
}

async function save(): Promise<void> {
  try {
    await createOutsourceOrder({
      supplierId: form.supplierId,
      productId: form.productId,
      warehouseId: form.warehouseId || undefined,
      qty: form.qty,
      unitPrice: form.unitPrice,
      remark: form.remark || undefined,
      lines: form.materials
    })
    createVisible.value = false
    ElMessage.success('委外单已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '创建失败')
  }
}

async function changeStatus(id: number, status: string): Promise<void> {
  try {
    await setOutsourceStatus(id, status)
    ElMessage.success(`状态已更新为 ${status}`)
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '状态更新失败')
  }
}

function openIssue(): void {
  Object.assign(issueForm, { issueType: 'PICK', materialId: 0, qty: '1', batchNo: '' })
  issueVisible.value = true
}

async function issue(): Promise<void> {
  if (!current.value) return
  try {
    await issueOutsourceMaterial(current.value.id, { ...issueForm })
    issueVisible.value = false
    ElMessage.success('物料流水已生成')
    await selectOrder(current.value.id)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '发料失败')
  }
}

function openReceive(): void {
  Object.assign(receiveForm, { qty: '1', batchNo: '' })
  receiveVisible.value = true
}

async function receive(): Promise<void> {
  if (!current.value) return
  try {
    await receiveOutsource(current.value.id, { ...receiveForm })
    receiveVisible.value = false
    ElMessage.success('完工入库已生成')
    await selectOrder(current.value.id)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '收货失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>委外加工</h2>
      <p>委外单发料、退料、完工入库均生成库存流水，状态机禁止非法跳转。</p>
    </header>

    <div class="outsource-layout">
      <article class="panel">
        <div class="panel-toolbar">
          <el-input v-model="query.keyword" placeholder="搜索委外单号" clearable @keyup.enter="load" />
          <el-button type="primary" v-perm="'purchase:order:create'" @click="openCreate">新增委外单</el-button>
          <el-button @click="load">刷新</el-button>
        </div>
        <el-table :data="orders" row-key="id" v-loading="loading" @row-click="selectOrder(Number($event.id))">
          <el-table-column prop="outsourceNo" label="委外单号" min-width="160" />
          <el-table-column prop="supplierId" label="供应商" width="110" />
          <el-table-column prop="qty" label="数量" width="110" />
          <el-table-column prop="receivedQty" label="已完工" width="110" />
          <el-table-column prop="status" label="状态" width="110" />
        </el-table>
        <div class="pagination">
          <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
        </div>
      </article>

      <article class="panel">
        <template v-if="current">
          <el-descriptions :column="2" border title="委外单详情">
            <el-descriptions-item label="单号">{{ current.outsourceNo }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ current.status }}</el-descriptions-item>
            <el-descriptions-item label="成品">{{ current.productId }}</el-descriptions-item>
            <el-descriptions-item label="供应商">{{ current.supplierId }}</el-descriptions-item>
            <el-descriptions-item label="应委外">{{ current.qty }}</el-descriptions-item>
            <el-descriptions-item label="已发料">{{ current.issuedQty }}</el-descriptions-item>
            <el-descriptions-item label="已完工">{{ current.receivedQty }}</el-descriptions-item>
            <el-descriptions-item label="金额">{{ current.amount }}</el-descriptions-item>
          </el-descriptions>

          <div class="actions">
            <el-button size="small" v-perm="'purchase:order:approve'" :disabled="current.status !== 'DRAFT'" @click="changeStatus(current.id, 'SUBMITTED')">提交</el-button>
            <el-button size="small" type="primary" v-perm="'purchase:order:approve'" :disabled="current.status !== 'SUBMITTED'" @click="changeStatus(current.id, 'APPROVED')">审批</el-button>
            <el-button size="small" v-perm="'purchase:order:update'" :disabled="!['APPROVED','PARTIAL'].includes(current.status)" @click="openIssue">发料/退料</el-button>
            <el-button size="small" type="success" v-perm="'purchase:order:update'" :disabled="!['APPROVED','PARTIAL'].includes(current.status)" @click="openReceive">完工入库</el-button>
          </div>

          <h3 class="section-title">物料明细</h3>
          <el-table :data="lines" row-key="id" size="small">
            <el-table-column prop="materialId" label="物料 ID" />
            <el-table-column prop="qty" label="应发" />
            <el-table-column prop="issuedQty" label="已发" />
            <el-table-column prop="returnedQty" label="已退" />
          </el-table>
        </template>
        <el-empty v-else description="请选择委外单" />
      </article>
    </div>

    <el-dialog v-model="createVisible" title="新增委外单" width="640px">
      <el-form label-width="90px">
        <el-form-item label="供应商 ID"><el-input-number v-model="form.supplierId" :min="1" /></el-form-item>
        <el-form-item label="成品 ID"><el-input-number v-model="form.productId" :min="1" /></el-form-item>
        <el-form-item label="仓库 ID"><el-input-number v-model="form.warehouseId" :min="0" /></el-form-item>
        <el-form-item label="数量"><el-input v-model="form.qty" /></el-form-item>
        <el-form-item label="单价"><el-input v-model="form.unitPrice" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" /></el-form-item>
      </el-form>
      <div class="line-title">委外物料</div>
      <div v-for="(line, index) in form.materials" :key="index" class="line-row">
        <el-input-number v-model="line.materialId" :min="1" placeholder="物料 ID" />
        <el-input v-model="line.qty" placeholder="数量" />
        <el-button @click="form.materials.splice(index, 1)">删除</el-button>
      </div>
      <el-button @click="form.materials.push({ materialId: 0, qty: '1' })">新增物料</el-button>
      <template #footer><el-button @click="createVisible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="issueVisible" title="发料或退料" width="460px">
      <el-form label-width="90px">
        <el-form-item label="类型">
          <el-select v-model="issueForm.issueType">
            <el-option label="发料" value="PICK" />
            <el-option label="退料" value="RETURN" />
          </el-select>
        </el-form-item>
        <el-form-item label="物料 ID"><el-input-number v-model="issueForm.materialId" :min="1" /></el-form-item>
        <el-form-item label="数量"><el-input v-model="issueForm.qty" /></el-form-item>
        <el-form-item label="批次"><el-input v-model="issueForm.batchNo" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="issueVisible = false">取消</el-button><el-button type="primary" @click="issue">确认</el-button></template>
    </el-dialog>

    <el-dialog v-model="receiveVisible" title="完工入库" width="440px">
      <el-form label-width="90px">
        <el-form-item label="数量"><el-input v-model="receiveForm.qty" /></el-form-item>
        <el-form-item label="批次"><el-input v-model="receiveForm.batchNo" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="receiveVisible = false">取消</el-button><el-button type="primary" @click="receive">确认</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.outsource-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
.section-title { margin: 18px 0 10px; }
.line-title { margin: 12px 0 8px; font-weight: 600; }
.line-row { display: grid; grid-template-columns: 1fr 1fr 80px; gap: 8px; margin-bottom: 8px; }
@media (max-width: 1100px) { .outsource-layout { grid-template-columns: 1fr; } }
</style>
