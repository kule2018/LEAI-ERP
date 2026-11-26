<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createCustomer,
  createCustomerAddress,
  createCustomerContact,
  deleteCustomer,
  fetchCustomerAddresses,
  fetchCustomerContacts,
  fetchCustomers,
  updateCustomer,
  type Customer,
  type CustomerAddress,
  type CustomerContact
} from '@/api/master-data'
import type { PageQuery } from '@/types/contract'

const rows = ref<Customer[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const selected = ref<Customer | null>(null)
const contacts = ref<CustomerContact[]>([])
const addresses = ref<CustomerAddress[]>([])
const detailLoading = ref(false)
const dialogVisible = ref(false)
const editingId = ref(0)
const form = reactive({
  customerCode: '',
  customerName: '',
  customerGroup: '',
  creditLimit: '0',
  ownerUserId: 0
})
const contactForm = reactive({ name: '', phone: '', email: '', position: '', isPrimary: 'NO' })
const addressForm = reactive({ province: '', city: '', district: '', address: '', contactName: '', contactPhone: '', isDefault: 'NO' })

let requestSeq = 0
let detailSeq = 0

const creditUsage = computed(() => {
  const limit = Number(selected.value?.creditLimit ?? 0)
  const used = Number(selected.value?.creditUsed ?? 0)
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
})

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchCustomers(query.value)
    if (seq !== requestSeq) return
    rows.value = result.list
    total.value = result.total
    if (!selected.value && result.list.length > 0) {
      selected.value = result.list[0]
    }
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function loadDetail(value: Customer | null): Promise<void> {
  if (!value) {
    contacts.value = []
    addresses.value = []
    return
  }
  const seq = ++detailSeq
  detailLoading.value = true
  try {
    const [contactList, addressList] = await Promise.all([
      fetchCustomerContacts(value.id),
      fetchCustomerAddresses(value.id)
    ])
    if (seq !== detailSeq) return
    contacts.value = contactList
    addresses.value = addressList
  } catch (cause) {
    if (seq === detailSeq) error.value = cause instanceof Error ? cause.message : '详情加载失败'
  } finally {
    if (seq === detailSeq) detailLoading.value = false
  }
}

watch(selected, (value) => {
  void loadDetail(value)
})

function selectRow(row: unknown): void {
  selected.value = row as Customer
}

function openAdd(): void {
  editingId.value = 0
  form.customerCode = ''
  form.customerName = ''
  form.customerGroup = ''
  form.creditLimit = '0'
  form.ownerUserId = 0
  dialogVisible.value = true
}

function openEdit(): void {
  if (!selected.value) return
  editingId.value = selected.value.id
  form.customerCode = selected.value.customerCode
  form.customerName = selected.value.customerName
  form.customerGroup = selected.value.customerGroup ?? ''
  form.creditLimit = selected.value.creditLimit
  form.ownerUserId = selected.value.ownerUserId ?? 0
  dialogVisible.value = true
}

async function saveCustomer(): Promise<void> {
  try {
    const payload = {
      customerCode: form.customerCode,
      customerName: form.customerName,
      customerGroup: form.customerGroup,
      creditLimit: form.creditLimit,
      ownerUserId: form.ownerUserId || undefined
    }
    if (editingId.value > 0) {
      await updateCustomer(editingId.value, {
        customerName: payload.customerName,
        customerGroup: payload.customerGroup,
        creditLimit: payload.creditLimit,
        ownerUserId: payload.ownerUserId
      })
    } else {
      await createCustomer(payload)
    }
    dialogVisible.value = false
    ElMessage.success('保存成功')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function removeCustomer(): Promise<void> {
  if (!selected.value) return
  await ElMessageBox.confirm(`确认删除客户「${selected.value.customerName}」？`, '提示', { type: 'warning' })
  await deleteCustomer(selected.value.id)
  selected.value = null
  ElMessage.success('已删除')
  await load()
}

async function saveContact(): Promise<void> {
  if (!selected.value) return
  try {
    await createCustomerContact(selected.value.id, { ...contactForm })
    contactForm.name = ''
    contactForm.phone = ''
    contactForm.email = ''
    contactForm.position = ''
    contactForm.isPrimary = 'NO'
    ElMessage.success('联系人已添加')
    await loadDetail(selected.value)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function saveAddress(): Promise<void> {
  if (!selected.value) return
  try {
    await createCustomerAddress(selected.value.id, { ...addressForm })
    addressForm.address = ''
    addressForm.contactName = ''
    addressForm.contactPhone = ''
    addressForm.isDefault = 'NO'
    ElMessage.success('地址已添加')
    await loadDetail(selected.value)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

function primaryLabel(row: unknown): string {
  return (row as CustomerContact).isPrimary === 1 ? '主要' : '普通'
}

function defaultLabel(row: unknown): string {
  return (row as CustomerAddress).isDefault === 1 ? '默认' : '普通'
}

onMounted(load)
onUnmounted(() => {
  requestSeq += 1
  detailSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>客户 360</h2>
      <p>客户档案、信用占用、联系人与收货地址集中维护；信用额度将在销售单提交时校验。</p>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="customer-layout">
      <article class="panel list-panel">
        <div class="panel-toolbar">
          <el-input v-model="query.keyword" placeholder="搜索客户" clearable @keyup.enter="load" />
          <el-button type="primary" v-perm="'sales:customer:create'" @click="openAdd">新增</el-button>
          <el-button @click="load">刷新</el-button>
        </div>
        <el-table v-loading="loading" :data="rows" row-key="id" highlight-current-row @row-click="selectRow">
          <el-table-column prop="customerCode" label="客户编码" width="120" />
          <el-table-column prop="customerName" label="客户名称" min-width="150" />
          <el-table-column prop="creditLimit" label="信用额度" width="120" />
        </el-table>
        <el-pagination background layout="prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" />
      </article>

      <article class="panel detail-panel" v-loading="detailLoading">
        <template v-if="selected">
          <div class="detail-header">
            <div>
              <h3>{{ selected.customerName }}</h3>
              <p>{{ selected.customerCode }} · {{ selected.customerGroup || '未分组' }}</p>
            </div>
            <div>
              <el-button v-perm="'sales:customer:update'" @click="openEdit">编辑</el-button>
              <el-button type="danger" v-perm="'sales:customer:delete'" @click="removeCustomer">删除</el-button>
            </div>
          </div>

          <div class="credit-card">
            <span>信用额度使用</span>
            <el-progress :percentage="creditUsage" :status="creditUsage >= 90 ? 'exception' : undefined" />
            <p>已用 {{ selected.creditUsed }} / 额度 {{ selected.creditLimit }}</p>
          </div>

          <el-tabs>
            <el-tab-pane label="联系人">
              <div class="inline-form">
                <el-input v-model="contactForm.name" placeholder="姓名" />
                <el-input v-model="contactForm.phone" placeholder="电话" />
                <el-input v-model="contactForm.email" placeholder="邮箱" />
                <el-button type="primary" v-perm="'sales:customer:update'" @click="saveContact">添加</el-button>
              </div>
              <el-table :data="contacts" row-key="id" size="small">
                <el-table-column prop="name" label="姓名" width="110" />
                <el-table-column prop="phone" label="电话" width="140" />
                <el-table-column prop="email" label="邮箱" min-width="160" />
                <el-table-column label="类型" width="80">
                  <template #default="{ row }"><el-tag :type="primaryLabel(row) === '主要' ? 'success' : 'info'">{{ primaryLabel(row) }}</el-tag></template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="收货地址">
              <div class="inline-form">
                <el-input v-model="addressForm.province" placeholder="省" />
                <el-input v-model="addressForm.city" placeholder="市" />
                <el-input v-model="addressForm.address" placeholder="详细地址" />
                <el-button type="primary" v-perm="'sales:customer:update'" @click="saveAddress">添加</el-button>
              </div>
              <el-table :data="addresses" row-key="id" size="small">
                <el-table-column prop="province" label="省" width="90" />
                <el-table-column prop="city" label="市" width="90" />
                <el-table-column prop="address" label="详细地址" min-width="200" />
                <el-table-column label="类型" width="80">
                  <template #default="{ row }"><el-tag :type="defaultLabel(row) === '默认' ? 'success' : 'info'">{{ defaultLabel(row) }}</el-tag></template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </template>
        <el-empty v-else description="请选择左侧客户" />
      </article>
    </div>

    <el-dialog v-model="dialogVisible" title="客户档案" width="560px">
      <el-form label-width="90px">
        <el-form-item label="客户编码"><el-input v-model="form.customerCode" :disabled="editingId > 0" /></el-form-item>
        <el-form-item label="客户名称"><el-input v-model="form.customerName" /></el-form-item>
        <el-form-item label="客户分组"><el-input v-model="form.customerGroup" /></el-form-item>
        <el-form-item label="信用额度"><el-input v-model="form.creditLimit" /></el-form-item>
        <el-form-item label="负责人ID"><el-input-number v-model="form.ownerUserId" :min="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCustomer">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.customer-layout { display: grid; grid-template-columns: minmax(360px, 0.9fr) minmax(460px, 1.1fr); gap: 16px; }
.panel { min-width: 0; padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.detail-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.detail-header h3 { margin: 0 0 6px; }
.detail-header p { margin: 0; color: #646a73; }
.credit-card { margin-bottom: 16px; padding: 14px; background: #f5f7fa; border-radius: 8px; }
.credit-card span { display: block; margin-bottom: 8px; color: #646a73; }
.credit-card p { margin: 8px 0 0; font-size: 12px; color: #646a73; }
.inline-form { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.error-banner { margin-bottom: 16px; padding: 12px 16px; color: #f5222d; background: #fff1f0; border-radius: 8px; }
@media (max-width: 1100px) { .customer-layout { grid-template-columns: 1fr; } }
</style>
