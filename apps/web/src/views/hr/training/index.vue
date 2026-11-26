<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createTraining, fetchTrainings, type CollabQuery, type Training } from '@/api/collaboration'
import { scoreTraining, signinTraining } from '@/api/project-ops'

const rows = ref<Training[]>([])
const loading = ref(false)
const query = ref<CollabQuery>({ page: 1, pageSize: 20 })
const form = reactive({ courseName: '', planDate: '' })
const examForm = reactive({ employeeId: 0, examScore: 60 })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchTrainings(query.value)
    if (current !== seq) return
    rows.value = result.list
  } finally { if (current === seq) loading.value = false }
}
async function save(): Promise<void> {
  try {
    await createTraining({ ...form, planDate: form.planDate || undefined })
    ElMessage.success('培训计划已保存')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function handleSignin(row: Training): Promise<void> {
  try {
    await signinTraining(row.id, { employeeId: examForm.employeeId })
    ElMessage.success('签到成功')
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '签到失败') }
}
async function handleScore(row: Training): Promise<void> {
  try {
    await scoreTraining(row.id, { employeeId: examForm.employeeId, examScore: examForm.examScore })
    ElMessage.success('成绩已登记，通过后自动发证')
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '登记失败') }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>培训</h2><p>课程、计划和状态记录。</p></header>
    <article class="panel">
      <el-form inline>
        <el-form-item label="课程"><el-input v-model="form.courseName" /></el-form-item>
        <el-form-item label="计划日期"><el-date-picker v-model="form.planDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-button type="primary" v-perm="'hr:training:create'" @click="save">保存</el-button>
      </el-form>
      <el-form inline>
        <el-form-item label="员工ID"><el-input-number v-model="examForm.employeeId" :min="1" /></el-form-item>
        <el-form-item label="考试成绩"><el-input-number v-model="examForm.examScore" :min="0" :max="100" /></el-form-item>
      </el-form>
      <el-table v-loading="loading" :data="rows" row-key="id" size="small">
        <el-table-column prop="courseName" label="课程" min-width="220" />
        <el-table-column prop="planDate" label="计划日期" width="140" />
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column label="签到/成绩" width="200">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'hr:training:create'" @click="handleSignin(row)">签到</el-button>
            <el-button link type="primary" v-perm="'hr:training:create'" @click="handleScore(row)">登记成绩</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
</style>
