<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createFeature, fetchFeatures, removeFeature, updateFeature, type FeatureFlag } from '@/api/feature'
import type { PageQuery } from '@/types/contract'

const rows = ref<FeatureFlag[]>([])
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const query = reactive<PageQuery & { status?: string; module?: string }>({ page: 1, pageSize: 20, keyword: '', status: '' })
const form = reactive({
  id: 0,
  code: '',
  name: '',
  module: '',
  status: 'ON' as 'ON' | 'OFF' | 'GRAY',
  grayUsers: '',
  grayRoles: '',
  grayPercent: 0
})

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchFeatures({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status ? { status: query.status } : {})
    })
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载功能开关失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, { id: 0, code: '', name: '', module: '', status: 'ON', grayUsers: '', grayRoles: '', grayPercent: 0 })
  visible.value = true
}

function openEditById(id: number): void {
  const row = rows.value.find((item) => item.id === id)
  if (!row) return
  Object.assign(form, {
    id: row.id,
    code: row.code,
    name: row.name,
    module: row.module,
    status: row.status,
    grayUsers: (row.grayUsers ?? []).join(','),
    grayRoles: (row.grayRoles ?? []).join(','),
    grayPercent: row.grayPercent
  })
  visible.value = true
}

function parseUsers(value: string): number[] {
  return value.split(',').map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0)
}

function parseRoles(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

async function save(): Promise<void> {
  const data = {
    code: form.code,
    name: form.name,
    module: form.module,
    status: form.status,
    grayUsers: parseUsers(form.grayUsers),
    grayRoles: parseRoles(form.grayRoles),
    grayPercent: form.grayPercent
  }
  try {
    if (form.id) await updateFeature(form.id, data)
    else await createFeature(data)
    visible.value = false
    ElMessage.success('功能开关已保存')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function removeById(id: number): Promise<void> {
  await ElMessageBox.confirm('确认删除该功能开关？', '提示', { type: 'warning' })
  try {
    await removeFeature(id)
    ElMessage.success('功能开关已删除')
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
      <h2>功能开关</h2>
      <p>支持模块级全开、全关与灰度发布；灰度按用户 ID、角色或百分比命中。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索功能名称或编码" clearable @keyup.enter="load" />
        <el-select v-model="query.status" clearable placeholder="状态" style="width: 140px" @change="load">
          <el-option label="开启" value="ON" />
          <el-option label="关闭" value="OFF" />
          <el-option label="灰度" value="GRAY" />
        </el-select>
        <el-button type="primary" v-perm="'system:feature:create'" @click="openCreate">新增开关</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table :data="rows" row-key="id" v-loading="loading">
        <el-table-column prop="code" label="功能码" width="180" />
        <el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column prop="module" label="模块" width="120" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column prop="grayPercent" label="灰度比例" width="110" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="170" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'system:feature:update'" @click="openEditById(Number(row.id))">编辑</el-button>
            <el-button link type="danger" v-perm="'system:feature:delete'" @click="removeById(Number(row.id))">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="visible" :title="form.id ? '编辑功能开关' : '新增功能开关'" width="560px">
      <el-form label-width="100px">
        <el-form-item label="功能码"><el-input v-model="form.code" :disabled="form.id > 0" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="模块"><el-input v-model="form.module" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="开启" value="ON" />
            <el-option label="关闭" value="OFF" />
            <el-option label="灰度" value="GRAY" />
          </el-select>
        </el-form-item>
        <el-form-item label="灰度用户"><el-input v-model="form.grayUsers" placeholder="多个用户 ID 用逗号分隔" /></el-form-item>
        <el-form-item label="灰度角色"><el-input v-model="form.grayRoles" placeholder="多个角色码用逗号分隔" /></el-form-item>
        <el-form-item label="灰度比例"><el-input-number v-model="form.grayPercent" :min="0" :max="100" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
