<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchSuppliers, type Supplier } from '@/api/master-data'
import {
  createPortalAccount,
  fetchPortalAccounts,
  resetPortalAccountPassword,
  updatePortalAccountStatus,
  type PortalAccount
} from '@/api/supplier-portal'

const suppliers = ref<Supplier[]>([])
const accounts = ref<PortalAccount[]>([])
const total = ref(0)
const loading = ref(false)
const submitting = ref(false)
const query = reactive({ page: 1, pageSize: 20, supplierId: undefined as number | undefined })
const createVisible = ref(false)
const createForm = reactive({
  supplierId: undefined as number | undefined,
  username: '',
  password: '',
  displayName: '',
  phone: '',
  email: ''
})

async function load(): Promise<void> {
  loading.value = true
  try {
    const [supplierResult, accountResult] = await Promise.all([
      fetchSuppliers({ page: 1, pageSize: 500 }),
      fetchPortalAccounts({ page: query.page, pageSize: query.pageSize, supplierId: query.supplierId })
    ])
    suppliers.value = supplierResult.list
    accounts.value = accountResult.list
    total.value = accountResult.total
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载门户账号失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(createForm, {
    supplierId: query.supplierId ?? suppliers.value[0]?.id,
    username: '',
    password: '',
    displayName: '',
    phone: '',
    email: ''
  })
  createVisible.value = true
}

async function submitCreate(): Promise<void> {
  if (!createForm.supplierId) { ElMessage.warning('请选择供应商'); return }
  if (!createForm.username.trim()) { ElMessage.warning('请填写登录账号'); return }
  if (!createForm.password) { ElMessage.warning('请填写初始密码'); return }
  submitting.value = true
  try {
    await createPortalAccount({
      supplierId: createForm.supplierId,
      username: createForm.username.trim(),
      password: createForm.password,
      displayName: createForm.displayName.trim() || undefined,
      phone: createForm.phone.trim() || undefined,
      email: createForm.email.trim() || undefined
    })
    ElMessage.success('门户账号已创建')
    createVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建失败')
  } finally {
    submitting.value = false
  }
}

async function toggleStatus(row: PortalAccount): Promise<void> {
  const next = row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
  try {
    await ElMessageBox.confirm(
      next === 'DISABLED' ? '停用后该供应商门户账号将立即无法登录，确认停用？' : '确认恢复该账号的登录权限？',
      '门户账号状态',
      { type: 'warning' }
    )
  } catch { return }
  try {
    await updatePortalAccountStatus(row.id, next)
    ElMessage.success(next === 'ACTIVE' ? '已启用' : '已停用')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '状态更新失败')
  }
}

async function resetPassword(row: PortalAccount): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt('请输入新密码（至少 8 位，含大小写字母与数字）', `重置 ${row.username} 的密码`, {
      inputType: 'password',
      inputValidator: (val: string) => (val && val.length >= 8 ? true : '密码长度至少 8 位')
    })
    await resetPortalAccountPassword(row.id, value)
    ElMessage.success('密码已重置')
  } catch (error) {
    if (error instanceof Error) {
      ElMessage.error(error.message)
    }
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>供应商门户账号</h2>
      <p>为外部供应商人员创建独立登录账号，账号仅能访问本供应商的订单、对账、发货与发票数据。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-select v-model="query.supplierId" style="width: 240px" placeholder="全部供应商" clearable @change="load">
          <el-option v-for="supplier in suppliers" :key="supplier.id" :label="supplier.supplierName" :value="supplier.id" />
        </el-select>
        <el-button @click="load">刷新</el-button>
        <el-button type="primary" v-perm="'purchase:portal:manage'" @click="openCreate">新建门户账号</el-button>
      </div>

      <el-table :data="accounts" row-key="id" size="small" v-loading="loading">
        <el-table-column prop="username" label="登录账号" min-width="140" />
        <el-table-column prop="displayName" label="联系人" min-width="120" />
        <el-table-column prop="supplierId" label="供应商ID" width="110" />
        <el-table-column prop="phone" label="电话" width="130" />
        <el-table-column prop="email" label="邮箱" min-width="160" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastLoginAt" label="最近登录" width="170" />
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'purchase:portal:manage'" @click="toggleStatus(row)">
              {{ row.status === 'ACTIVE' ? '停用' : '启用' }}
            </el-button>
            <el-button link type="warning" v-perm="'purchase:portal:manage'" @click="resetPassword(row)">重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pager"
        layout="total, prev, pager, next"
        :total="total"
        :page-size="query.pageSize"
        :current-page="query.page"
        @current-change="(page: number) => { query.page = page; load() }"
      />
    </article>

    <el-dialog v-model="createVisible" title="新建门户账号" width="520px" :close-on-click-modal="false">
      <el-form label-width="90px" size="small">
        <el-form-item label="供应商">
          <el-select v-model="createForm.supplierId" placeholder="选择供应商" style="width: 100%">
            <el-option v-for="supplier in suppliers" :key="supplier.id" :label="supplier.supplierName" :value="supplier.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="登录账号"><el-input v-model="createForm.username" placeholder="供应商登录账号" /></el-form-item>
        <el-form-item label="初始密码"><el-input v-model="createForm.password" type="password" show-password placeholder="至少 8 位，含大小写字母与数字" /></el-form-item>
        <el-form-item label="联系人"><el-input v-model="createForm.displayName" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="createForm.phone" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="createForm.email" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pager { margin-top: 12px; justify-content: flex-end; }
</style>
