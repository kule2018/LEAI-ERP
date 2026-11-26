<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createProject, fetchProjects, type CollabQuery, type Project } from '@/api/collaboration'

const rows = ref<Project[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<CollabQuery>({ page: 1, pageSize: 20 })
const visible = ref(false)
const form = reactive({ projectCode: '', projectName: '', ownerId: 0, startDate: '', endDate: '' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchProjects(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { projectCode: '', projectName: '', ownerId: 0, startDate: '', endDate: '' }); visible.value = true }
async function save(): Promise<void> {
  try {
    await createProject({ ...form, ownerId: form.ownerId || undefined, startDate: form.startDate || undefined, endDate: form.endDate || undefined })
    visible.value = false
    ElMessage.success('项目已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>项目管理</h2><p>项目台账与负责人维护。</p></header>
    <article class="panel">
      <div class="toolbar"><el-button type="primary" v-perm="'oa:project:create'" @click="openAdd">新建项目</el-button><el-button @click="load">刷新</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="projectCode" label="项目编号" width="150" />
        <el-table-column prop="projectName" label="项目名称" min-width="200" />
        <el-table-column prop="ownerId" label="负责人ID" width="120" />
        <el-table-column prop="startDate" label="开始" width="120" />
        <el-table-column prop="endDate" label="结束" width="120" />
        <el-table-column prop="status" label="状态" width="110" />
      </el-table>
    </article>
    <el-dialog v-model="visible" title="新建项目" width="560px">
      <el-form label-width="90px">
        <el-form-item label="项目编号"><el-input v-model="form.projectCode" /></el-form-item>
        <el-form-item label="项目名称"><el-input v-model="form.projectName" /></el-form-item>
        <el-form-item label="负责人ID"><el-input-number v-model="form.ownerId" :min="0" /></el-form-item>
        <el-form-item label="开始日期"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="结束日期"><el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
