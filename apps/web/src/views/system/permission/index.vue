<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createSystemPermission,
  fetchSystemPermissions,
  removeSystemPermission,
  updateSystemPermission,
  type SystemPermission
} from '@/api/system-admin'
import type { PageQuery } from '@/types/contract'

const rows = ref<SystemPermission[]>([])
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const form = reactive({ id: 0, permCode: '', permName: '', permType: 'MENU', parentId: 0, sortNo: 0 })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchSystemPermissions(query)
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载权限失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, { id: 0, permCode: '', permName: '', permType: 'MENU', parentId: 0, sortNo: 0 })
  visible.value = true
}

function openEditById(id: number): void {
  const row = rows.value.find((item) => item.id === id)
  if (!row) return
  Object.assign(form, {
    id: row.id, permCode: row.permCode, permName: row.permName,
    permType: row.permType, parentId: row.parentId ?? 0, sortNo: row.sortNo
  })
  visible.value = true
}

async function save(): Promise<void> {
  const { id, ...data } = form
  try {
    const payload = { ...data, parentId: data.parentId || undefined }
    if (id) await updateSystemPermission(id, payload)
    else await createSystemPermission(payload)
    visible.value = false
    ElMessage.success('权限已保存')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function removeById(id: number): Promise<void> {
  await ElMessageBox.confirm('确认删除该权限？', '提示', { type: 'warning' })
  try {
    await removeSystemPermission(id)
    ElMessage.success('权限已删除')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '删除失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>权限</h2>
      <p>权限码采用 module:resource:action 规范，角色通过权限 ID 关联授权集合。</p>
    </header>
    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索权限码" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'system:permission:create'" @click="openCreate">新增权限</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table :data="rows" row-key="id" v-loading="loading">
        <el-table-column prop="permCode" label="权限码" min-width="220" />
        <el-table-column prop="permName" label="权限名称" min-width="180" />
        <el-table-column prop="permType" label="类型" width="110" />
        <el-table-column prop="parentId" label="父级 ID" width="100" />
        <el-table-column prop="sortNo" label="排序" width="80" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'system:permission:update'" @click="openEditById(Number(row.id))">编辑</el-button>
            <el-button link type="danger" v-perm="'system:permission:delete'" @click="removeById(Number(row.id))">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="visible" :title="form.id ? '编辑权限' : '新增权限'" width="520px">
      <el-form label-width="100px">
        <el-form-item label="权限码"><el-input v-model="form.permCode" :disabled="form.id > 0" /></el-form-item>
        <el-form-item label="权限名称"><el-input v-model="form.permName" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.permType">
            <el-option label="菜单" value="MENU" />
            <el-option label="按钮" value="BUTTON" />
            <el-option label="接口" value="API" />
          </el-select>
        </el-form-item>
        <el-form-item label="父级 ID"><el-input-number v-model="form.parentId" :min="0" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sortNo" :min="0" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
