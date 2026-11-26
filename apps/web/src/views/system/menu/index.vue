<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createSystemMenu,
  fetchSystemMenus,
  removeSystemMenu,
  updateSystemMenu,
  type SystemMenu
} from '@/api/system-admin'
import type { PageQuery } from '@/types/contract'

const rows = ref<SystemMenu[]>([])
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const form = reactive({
  id: 0, parentId: 0, menuName: '', routePath: '', componentPath: '', icon: '', permCode: '', sortNo: 0, hidden: 'NO'
})

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchSystemMenus(query)
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载菜单失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, {
    id: 0, parentId: 0, menuName: '', routePath: '', componentPath: '', icon: '', permCode: '', sortNo: 0, hidden: 'NO'
  })
  visible.value = true
}

function openEditById(id: number): void {
  const row = rows.value.find((item) => item.id === id)
  if (!row) return
  Object.assign(form, {
    id: row.id, parentId: row.parentId ?? 0, menuName: row.menuName, routePath: row.routePath,
    componentPath: row.componentPath ?? '', icon: row.icon ?? '', permCode: row.permCode ?? '',
    sortNo: row.sortNo, hidden: row.hidden === 1 ? 'YES' : 'NO'
  })
  visible.value = true
}

async function save(): Promise<void> {
  const { id, ...data } = form
  try {
    const payload = {
      ...data,
      parentId: data.parentId || undefined,
      componentPath: data.componentPath || undefined,
      icon: data.icon || undefined,
      permCode: data.permCode || undefined
    }
    if (id) await updateSystemMenu(id, payload)
    else await createSystemMenu(payload)
    visible.value = false
    ElMessage.success('菜单已保存，刷新后生效')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function removeById(id: number): Promise<void> {
  await ElMessageBox.confirm('确认删除该菜单？', '提示', { type: 'warning' })
  try {
    await removeSystemMenu(id)
    ElMessage.success('菜单已删除')
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
      <h2>菜单</h2>
      <p>菜单由后端驱动动态路由；隐藏菜单保留路由直达但不进入侧边栏。</p>
    </header>
    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索菜单名称" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'system:menu:create'" @click="openCreate">新增菜单</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table :data="rows" row-key="id" v-loading="loading">
        <el-table-column prop="menuName" label="菜单名称" min-width="150" />
        <el-table-column prop="routePath" label="路由" min-width="180" />
        <el-table-column prop="componentPath" label="组件" min-width="200" />
        <el-table-column prop="permCode" label="权限码" min-width="180" />
        <el-table-column prop="parentId" label="父级 ID" width="100" />
        <el-table-column prop="sortNo" label="排序" width="80" />
        <el-table-column label="隐藏" width="80">
          <template #default="{ row }">{{ row.hidden === 1 ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'system:menu:update'" @click="openEditById(Number(row.id))">编辑</el-button>
            <el-button link type="danger" v-perm="'system:menu:delete'" @click="removeById(Number(row.id))">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="visible" :title="form.id ? '编辑菜单' : '新增菜单'" width="620px">
      <el-form label-width="100px">
        <el-form-item label="父级 ID"><el-input-number v-model="form.parentId" :min="0" /></el-form-item>
        <el-form-item label="菜单名称"><el-input v-model="form.menuName" /></el-form-item>
        <el-form-item label="路由"><el-input v-model="form.routePath" /></el-form-item>
        <el-form-item label="组件路径"><el-input v-model="form.componentPath" /></el-form-item>
        <el-form-item label="图标"><el-input v-model="form.icon" /></el-form-item>
        <el-form-item label="权限码"><el-input v-model="form.permCode" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sortNo" :min="0" /></el-form-item>
        <el-form-item label="隐藏">
          <el-select v-model="form.hidden">
            <el-option label="否" value="NO" />
            <el-option label="是" value="YES" />
          </el-select>
        </el-form-item>
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
