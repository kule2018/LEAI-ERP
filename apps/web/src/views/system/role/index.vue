<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  assignRolePermissions,
  createSystemRole,
  fetchSystemPermissions,
  fetchSystemRoles,
  removeSystemRole,
  updateSystemRole,
  type SystemPermission,
  type SystemRole
} from '@/api/system-admin'
import type { PageQuery } from '@/types/contract'

const rows = ref<SystemRole[]>([])
const permissions = ref<SystemPermission[]>([])
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const assignVisible = ref(false)
const currentRoleId = ref(0)
const selectedPermissionIds = ref<number[]>([])
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const form = reactive({ id: 0, roleCode: '', roleName: '', dataScopeLevel: 'SELF', parentId: null as number | null, sortNo: 0, status: 'ACTIVE', remark: '' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const [roleResult, permissionResult] = await Promise.all([
      fetchSystemRoles(query),
      fetchSystemPermissions({ page: 1, pageSize: 500 })
    ])
    rows.value = roleResult.list
    total.value = roleResult.total
    permissions.value = permissionResult.list
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载角色失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, { id: 0, roleCode: '', roleName: '', dataScopeLevel: 'SELF', parentId: null, sortNo: 0, status: 'ACTIVE', remark: '' })
  visible.value = true
}

function openEditById(id: number): void {
  const row = rows.value.find((item) => item.id === id)
  if (!row) return
  Object.assign(form, {
    id: row.id, roleCode: row.roleCode, roleName: row.roleName,
    dataScopeLevel: row.dataScopeLevel, parentId: row.parentId ?? null,
    sortNo: row.sortNo, status: row.status, remark: ''
  })
  visible.value = true
}

async function save(): Promise<void> {
  const { id, ...data } = form
  try {
    if (id) await updateSystemRole(id, data)
    else await createSystemRole(data)
    visible.value = false
    ElMessage.success('角色已保存')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function removeById(id: number): Promise<void> {
  await ElMessageBox.confirm('确认删除该角色？', '提示', { type: 'warning' })
  try {
    await removeSystemRole(id)
    ElMessage.success('角色已删除')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '删除失败')
  }
}

function openAssign(id: number): void {
  currentRoleId.value = id
  selectedPermissionIds.value = []
  assignVisible.value = true
}

async function saveAssign(): Promise<void> {
  try {
    await assignRolePermissions(currentRoleId.value, selectedPermissionIds.value)
    assignVisible.value = false
    ElMessage.success('权限分配已保存')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '分配失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>角色</h2>
      <p>角色聚合权限码并定义数据权限级别；权限变更会同步影响登录用户的授权集合。</p>
    </header>
    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索角色名称" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'system:role:create'" @click="openCreate">新增角色</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table :data="rows" row-key="id" v-loading="loading">
        <el-table-column prop="roleCode" label="角色编码" width="150" />
        <el-table-column prop="roleName" label="角色名称" min-width="160" />
        <el-table-column prop="dataScopeLevel" label="数据权限" width="150" />
        <el-table-column prop="parentId" label="父角色 ID" width="110" />
        <el-table-column prop="sortNo" label="排序" width="80" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'system:role:update'" @click="openEditById(Number(row.id))">编辑</el-button>
            <el-button link type="warning" v-perm="'system:role:update'" @click="openAssign(Number(row.id))">权限</el-button>
            <el-button link type="danger" v-perm="'system:role:delete'" @click="removeById(Number(row.id))">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="visible" :title="form.id ? '编辑角色' : '新增角色'" width="540px">
      <el-form label-width="100px">
        <el-form-item label="角色编码"><el-input v-model="form.roleCode" :disabled="form.id > 0" /></el-form-item>
        <el-form-item label="角色名称"><el-input v-model="form.roleName" /></el-form-item>
        <el-form-item label="数据权限">
          <el-select v-model="form.dataScopeLevel">
            <el-option label="仅本人" value="SELF" />
            <el-option label="本部门" value="DEPT" />
            <el-option label="本部门及下级" value="DEPT_AND_CHILD" />
            <el-option label="本组织" value="ORG" />
            <el-option label="全部" value="ALL" />
          </el-select>
        </el-form-item>
        <el-form-item label="父角色">
          <el-select v-model="form.parentId" clearable placeholder="无">
            <el-option v-for="item in rows.filter((row) => row.id !== form.id)" :key="item.id" :label="item.roleName" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sortNo" :min="0" /></el-form-item>
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

    <el-dialog v-model="assignVisible" title="分配权限" width="620px">
      <el-checkbox-group v-model="selectedPermissionIds" class="permission-list">
        <el-checkbox v-for="item in permissions" :key="item.id" :value="item.id">
          {{ item.permCode }}
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
.permission-list { display: grid; grid-template-columns: repeat(3, 1fr); max-height: 420px; overflow-y: auto; }
</style>
