<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createOaTask, fetchOaTasks, type CollabQuery, type OaTask } from '@/api/collaboration'

const rows = ref<OaTask[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<CollabQuery>({ page: 1, pageSize: 20 })
const visible = ref(false)
const form = reactive({ taskName: '', projectId: 0, assigneeId: 0, dueDate: '' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchOaTasks(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { taskName: '', projectId: 0, assigneeId: 0, dueDate: '' }); visible.value = true }
async function save(): Promise<void> {
  try {
    await createOaTask({ ...form, projectId: form.projectId || undefined, assigneeId: form.assigneeId || undefined, dueDate: form.dueDate || undefined })
    visible.value = false
    ElMessage.success('任务已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>会议任务</h2><p>纪要转任务、责任人和截止日期跟踪。</p></header>
    <article class="panel">
      <div class="toolbar"><el-button type="primary" v-perm="'oa:task:create'" @click="openAdd">新增任务</el-button><el-button @click="load">刷新</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="taskName" label="任务" min-width="220" />
        <el-table-column prop="projectId" label="项目ID" width="110" />
        <el-table-column prop="assigneeId" label="负责人ID" width="120" />
        <el-table-column prop="dueDate" label="截止日期" width="130" />
        <el-table-column prop="status" label="状态" width="110" />
      </el-table>
    </article>
    <el-dialog v-model="visible" title="新增任务" width="560px">
      <el-form label-width="90px">
        <el-form-item label="任务名称"><el-input v-model="form.taskName" /></el-form-item>
        <el-form-item label="项目ID"><el-input-number v-model="form.projectId" :min="0" /></el-form-item>
        <el-form-item label="负责人ID"><el-input-number v-model="form.assigneeId" :min="0" /></el-form-item>
        <el-form-item label="截止日期"><el-date-picker v-model="form.dueDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
