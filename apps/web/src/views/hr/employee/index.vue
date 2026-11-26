<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BaseDrawer from '@/components/BaseDrawer.vue'
import BaseGrid from '@/components/BaseGrid.vue'
import ViewConfigToolbar from '@/components/ViewConfigToolbar.vue'
import { useViewConfig } from '@/utils/view-config'
import {
  createEmployee,
  deleteEmployee,
  fetchEmployees,
  updateEmployee,
  type Employee
} from '@/api/master-data'
import type { FieldDef, GridColumn, PageQuery } from '@/types/contract'

const VIEW_PAGE_KEY = 'hr.employee'

const columns: GridColumn[] = [
  { prop: 'employeeNo', label: '工号', width: 130 },
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'deptId', label: '部门ID', width: 110 },
  { prop: 'positionId', label: '岗位ID', width: 110 },
  { prop: 'mobile', label: '手机号', width: 150 },
  { prop: 'email', label: '邮箱', width: 180 },
  { prop: 'hireDate', label: '入职日期', width: 120 },
  { prop: 'status', label: '状态', width: 100 }
]

const view = useViewConfig(VIEW_PAGE_KEY, columns)

const fields: FieldDef[] = [
  { key: 'employeeNo', label: '工号', type: 'input', required: true, maxlength: 50 },
  { key: 'name', label: '姓名', type: 'input', required: true, maxlength: 64 },
  { key: 'deptId', label: '部门ID', type: 'int' },
  { key: 'positionId', label: '岗位ID', type: 'int' },
  { key: 'userId', label: '关联用户ID', type: 'int' },
  { key: 'mobile', label: '手机号', type: 'input', maxlength: 30 },
  { key: 'email', label: '邮箱', type: 'input', maxlength: 100 },
  { key: 'hireDate', label: '入职日期', type: 'input', maxlength: 10 }
]

const rows = ref<Employee[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const drawerVisible = ref(false)
const isEdit = ref(false)
const editingId = ref(0)
const submitting = ref(false)
const form = ref<Record<string, unknown>>(createEmptyForm())

let requestSeq = 0

function createEmptyForm(): Record<string, unknown> {
  return {
    employeeNo: '',
    name: '',
    deptId: 0,
    positionId: 0,
    userId: 0,
    mobile: '',
    email: '',
    hireDate: ''
  }
}

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchEmployees(query.value)
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
  isEdit.value = false
  editingId.value = 0
  form.value = createEmptyForm()
  drawerVisible.value = true
}

function openEdit(row: unknown): void {
  const employee = row as Employee
  isEdit.value = true
  editingId.value = employee.id
  form.value = {
    ...createEmptyForm(),
    employeeNo: employee.employeeNo,
    name: employee.name,
    deptId: employee.deptId ?? 0,
    positionId: employee.positionId ?? 0,
    userId: employee.userId ?? 0,
    mobile: employee.mobile ?? '',
    email: employee.email ?? '',
    hireDate: employee.hireDate ?? ''
  }
  drawerVisible.value = true
}

function buildPayload(): Record<string, unknown> {
  return {
    name: String(form.value.name ?? ''),
    deptId: Number(form.value.deptId ?? 0) || undefined,
    positionId: Number(form.value.positionId ?? 0) || undefined,
    userId: Number(form.value.userId ?? 0) || undefined,
    mobile: String(form.value.mobile ?? ''),
    email: String(form.value.email ?? ''),
    hireDate: String(form.value.hireDate ?? '')
  }
}

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    const payload = buildPayload()
    if (isEdit.value) {
      await updateEmployee(editingId.value, payload)
    } else {
      await createEmployee({ employeeNo: String(form.value.employeeNo ?? ''), ...payload })
    }
    drawerVisible.value = false
    ElMessage.success('保存成功')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: unknown): Promise<void> {
  const employee = row as Employee
  await ElMessageBox.confirm(`确认删除员工「${employee.name}」？`, '提示', { type: 'warning' })
  await deleteEmployee(employee.id)
  ElMessage.success('已删除')
  await load()
}

function handlePage(value: number): void {
  query.value.page = value
  void load()
}

function handlePageSize(value: number): void {
  query.value.pageSize = value
  void load()
}

onMounted(load)
onUnmounted(() => {
  requestSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>员工档案</h2>
      <p>维护员工基础信息、组织岗位和登录用户关联；考勤、薪酬等模块将在后续阶段接入。</p>
    </header>

    <BaseGrid
      :columns="view.visibleColumns.value"
      :density="view.density.value"
      :rows="rows"
      :loading="loading"
      :error="error"
      :total="total"
      :page="query.page"
      :page-size="query.pageSize"
      perm-prefix="hr:employee"
      @refresh="load"
      @add="openAdd"
      @edit="openEdit"
      @delete="handleDelete"
      @update:page="handlePage"
      @update:page-size="handlePageSize"
    >
      <template #toolbar>
        <ViewConfigToolbar
          page-key="hr.employee"
          :columns="columns"
          :view="view"
          title="员工档案"
          route="/hr/employee"
        />
        <el-input v-model="query.keyword" placeholder="搜索员工" clearable @keyup.enter="load" />
      </template>
    </BaseGrid>

    <BaseDrawer
      v-model="drawerVisible"
      :title="isEdit ? '编辑员工' : '新增员工'"
      :fields="fields"
      :form="form"
      :loading="submitting"
      :is-edit="isEdit"
      submit-perm="hr:employee:update"
      @update:form="form = $event"
      @submit="handleSubmit"
    />
  </section>
</template>
