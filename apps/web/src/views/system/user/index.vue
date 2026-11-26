<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  assignUserRoles,
  createSystemUser,
  fetchSystemRoles,
  fetchSystemUsers,
  removeSystemUser,
  updateSystemUser,
  type SystemRole,
  type SystemUser
} from '@/api/system-admin'
import type { PageQuery } from '@/types/contract'

const rows = ref<SystemUser[]>([])
const roles = ref<SystemRole[]>([])
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const assignVisible = ref(false)
const currentUserId = ref(0)
const selectedRoleIds = ref<number[]>([])
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const form = reactive({ id: 0, username: '', password: '', realName: '', deptId: 0, orgId: 0, mobile: '', status: 'ACTIVE', remark: '' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const [userResult, roleResult] = await Promise.all([
      fetchSystemUsers(query),
      fetchSystemRoles({ page: 1, pageSize: 500 })
    ])
    rows.value = userResult.list
    total.value = userResult.total
    roles.value = roleResult.list
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载用户失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, { id: 0, username: '', password: '', realName: '', deptId: 0, orgId: 0, mobile: '', status: 'ACTIVE', remark: '' })
  visible.value = true
}

function openEditById(id: number): void {
  const row = rows.value.find((item) => item.id === id)
  if (!row) return
  Object.assign(form, {
    id: row.id, username: row.username, password: '', realName: row.realName,
    deptId: row.deptId ?? 0, orgId: row.orgId ?? 0, mobile: row.mobile ?? '', status: row.status, remark: ''
  })
  visible.value = true
}

async function save(): Promise<void> {
  const { id, ...data } = form
  try {
    const payload = {
      ...data,
      password: data.password || undefined,
      deptId: data.deptId || undefined,
      orgId: data.orgId || undefined
    }
    if (id) await updateSystemUser(id, payload)
    else await createSystemUser(payload)
    visible.value = false
    ElMessage.success('用户已保存')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function removeById(id: number): Promise<void> {
  await ElMessageBox.confirm('确认删除该用户？', '提示', { type: 'warning' })
  try {
    await removeSystemUser(id)
    ElMessage.success('用户已删除')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '删除失败')
  }
}

function openAssign(id: number): void {
  currentUserId.value = id
  selectedRoleIds.value = []
  assignVisible.value = true
}

async function saveAssign(): Promise<void> {
  try {
    await assignUserRoles(currentUserId.value, selectedRoleIds.value)
    assignVisible.value = false
    ElMessage.success('角色分配已保存')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '分配失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>用户</h2>
      <p>用户绑定部门与组织，通过角色继承权限码和数据权限级别。</p>
    </header>
    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索用户名" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'system:user:create'" @click="openCreate">新增用户</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table :data="rows" row-key="id" v-loading="loading">
        <el-table-column prop="username" label="用户名" width="140" />
        <el-table-column prop="realName" label="姓名" width="120" />
        <el-table-column prop="mobile" label="手机" width="140" />
        <el-table-column prop="deptId" label="部门 ID" width="100" />
        <el-table-column prop="orgId" label="组织 ID" width="100" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'system:user:update'" @click="openEditById(Number(row.id))">编辑</el-button>
            <el-button link type="warning" v-perm="'system:user:update'" @click="openAssign(Number(row.id))">角色</el-button>
            <el-button link type="danger" v-perm="'system:user:delete'" @click="removeById(Number(row.id))">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="visible" :title="form.id ? '编辑用户' : '新增用户'" width="560px">
      <el-form label-width="90px">
        <el-form-item label="用户名"><el-input v-model="form.username" :disabled="form.id > 0" /></el-form-item>
        <el-form-item :label="form.id ? '重置密码' : '密码'"><el-input v-model="form.password" type="password" show-password /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="form.realName" /></el-form-item>
        <el-form-item label="部门 ID"><el-input-number v-model="form.deptId" :min="0" /></el-form-item>
        <el-form-item label="组织 ID"><el-input-number v-model="form.orgId" :min="0" /></el-form-item>
        <el-form-item label="手机"><el-input v-model="form.mobile" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="assignVisible" title="分配角色" width="480px">
      <el-checkbox-group v-model="selectedRoleIds">
        <el-checkbox v-for="role in roles" :key="role.id" :value="role.id" style="display: block">
          {{ role.roleName }}（{{ role.roleCode }}）
        </el-checkbox>
      </el-checkbox-group>
      <template #footer><el-button @click="assignVisible = false">取消</el-button><el-button type="primary" @click="saveAssign">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
