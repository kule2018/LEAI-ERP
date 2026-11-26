<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createPosition, fetchPositions, removePosition, updatePosition, type Position } from '@/api/system-admin'
import type { PageQuery } from '@/types/contract'

const rows = ref<Position[]>([])
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const form = reactive({ id: 0, orgId: 0, deptId: 0, positionCode: '', positionName: '', grade: 'P1', sortNo: 0, status: 'ACTIVE' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchPositions(query)
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载岗位失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, { id: 0, orgId: 0, deptId: 0, positionCode: '', positionName: '', grade: 'P1', sortNo: 0, status: 'ACTIVE' })
  visible.value = true
}

function openEditById(id: number): void {
  const row = rows.value.find((item) => item.id === id)
  if (!row) return
  Object.assign(form, {
    id: row.id, orgId: row.orgId, deptId: row.deptId ?? 0, positionCode: row.positionCode,
    positionName: row.positionName, grade: row.grade, sortNo: row.sortNo, status: row.status
  })
  visible.value = true
}

async function save(): Promise<void> {
  const { id, ...data } = form
  try {
    const payload = { ...data, deptId: data.deptId || undefined }
    if (id) await updatePosition(id, payload)
    else await createPosition(payload)
    visible.value = false
    ElMessage.success('岗位已保存')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function removeById(id: number): Promise<void> {
  await ElMessageBox.confirm('确认删除该岗位？', '提示', { type: 'warning' })
  try {
    await removePosition(id)
    ElMessage.success('岗位已删除')
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
      <h2>岗位</h2>
      <p>岗位与组织、部门绑定，为用户授权和数据权限提供职位维度。</p>
    </header>
    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索岗位名称" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'system:position:create'" @click="openCreate">新增岗位</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table :data="rows" row-key="id" v-loading="loading">
        <el-table-column prop="positionCode" label="岗位编码" width="140" />
        <el-table-column prop="positionName" label="岗位名称" min-width="180" />
        <el-table-column prop="orgId" label="组织 ID" width="110" />
        <el-table-column prop="deptId" label="部门 ID" width="110" />
        <el-table-column prop="grade" label="职级" width="100" />
        <el-table-column prop="sortNo" label="排序" width="80" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'system:position:update'" @click="openEditById(Number(row.id))">编辑</el-button>
            <el-button link type="danger" v-perm="'system:position:delete'" @click="removeById(Number(row.id))">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="visible" :title="form.id ? '编辑岗位' : '新增岗位'" width="540px">
      <el-form label-width="100px">
        <el-form-item label="组织 ID"><el-input-number v-model="form.orgId" :min="1" /></el-form-item>
        <el-form-item label="部门 ID"><el-input-number v-model="form.deptId" :min="0" /></el-form-item>
        <el-form-item label="岗位编码"><el-input v-model="form.positionCode" :disabled="form.id > 0" /></el-form-item>
        <el-form-item label="岗位名称"><el-input v-model="form.positionName" /></el-form-item>
        <el-form-item label="职级"><el-input v-model="form.grade" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sortNo" :min="0" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
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
