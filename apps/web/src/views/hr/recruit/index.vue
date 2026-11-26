<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createCandidate, createInterview, createRecruit, fetchCandidates, fetchInterviews,
  fetchRecruits, type Candidate, type CollabQuery, type Interview, type Recruit
} from '@/api/collaboration'

const demands = ref<Recruit[]>([])
const candidates = ref<Candidate[]>([])
const interviews = ref<Interview[]>([])
const query = ref<CollabQuery>({ page: 1, pageSize: 100 })
const kind = ref('')
const dialogVisible = ref(false)
const form = reactive({ positionName: '', headcount: 1, demandId: 0, name: '', mobile: '', candidateId: 0, interviewerId: 0, feedback: '' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  try {
    const [d, c, i] = await Promise.all([fetchRecruits(query.value), fetchCandidates(query.value), fetchInterviews(query.value)])
    if (current !== seq) return
    demands.value = d.list
    candidates.value = c.list
    interviews.value = i.list
  } finally { /* noop */ }
}
function open(type: string): void { kind.value = type; dialogVisible.value = true; Object.assign(form, { positionName: '', headcount: 1, demandId: 0, name: '', mobile: '', candidateId: 0, interviewerId: 0, feedback: '' }) }
async function save(): Promise<void> {
  try {
    if (kind.value === 'demand') await createRecruit({ positionName: form.positionName, headcount: form.headcount })
    if (kind.value === 'candidate') await createCandidate({ demandId: form.demandId || undefined, name: form.name, mobile: form.mobile })
    if (kind.value === 'interview') await createInterview({ candidateId: form.candidateId, interviewerId: form.interviewerId, feedback: form.feedback })
    dialogVisible.value = false
    ElMessage.success('已保存')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>招聘</h2><p>招聘需求、候选人和面试安排。</p></header>
    <el-tabs>
      <el-tab-pane label="招聘需求">
        <el-button type="primary" size="small" v-perm="'hr:recruit:create'" @click="open('demand')">新增需求</el-button>
        <el-table :data="demands" size="small" row-key="id" class="table">
          <el-table-column prop="demandNo" label="需求单号" width="170" />
          <el-table-column prop="positionName" label="岗位" min-width="180" />
          <el-table-column prop="headcount" label="人数" width="90" />
          <el-table-column prop="status" label="状态" width="110" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="候选人">
        <el-button type="primary" size="small" v-perm="'hr:recruit:create'" @click="open('candidate')">新增候选人</el-button>
        <el-table :data="candidates" size="small" row-key="id" class="table">
          <el-table-column prop="name" label="姓名" width="120" />
          <el-table-column prop="mobile" label="电话" width="150" />
          <el-table-column prop="stage" label="阶段" width="120" />
          <el-table-column prop="score" label="评分" width="90" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="面试">
        <el-button type="primary" size="small" v-perm="'hr:recruit:create'" @click="open('interview')">安排面试</el-button>
        <el-table :data="interviews" size="small" row-key="id" class="table">
          <el-table-column prop="candidateId" label="候选人ID" width="120" />
          <el-table-column prop="interviewerId" label="面试官ID" width="120" />
          <el-table-column prop="result" label="结果" width="110" />
          <el-table-column prop="feedback" label="反馈" min-width="200" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
    <el-dialog v-model="dialogVisible" title="招聘信息" width="520px">
      <el-form label-width="90px">
        <template v-if="kind === 'demand'">
          <el-form-item label="岗位"><el-input v-model="form.positionName" /></el-form-item>
          <el-form-item label="人数"><el-input-number v-model="form.headcount" :min="1" /></el-form-item>
        </template>
        <template v-else-if="kind === 'candidate'">
          <el-form-item label="需求ID"><el-input-number v-model="form.demandId" :min="0" /></el-form-item>
          <el-form-item label="姓名"><el-input v-model="form.name" /></el-form-item>
          <el-form-item label="电话"><el-input v-model="form.mobile" /></el-form-item>
        </template>
        <template v-else>
          <el-form-item label="候选人ID"><el-input-number v-model="form.candidateId" :min="1" /></el-form-item>
          <el-form-item label="面试官ID"><el-input-number v-model="form.interviewerId" :min="1" /></el-form-item>
          <el-form-item label="反馈"><el-input v-model="form.feedback" /></el-form-item>
        </template>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.table { margin-top: 12px; }
</style>
