<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createPerformance, fetchPerformances, type CollabQuery, type Performance } from '@/api/collaboration'
import {
  appealPerformance, createCalibration, createPerformanceKpi, fetchCalibrations, fetchPerformanceKpis,
  fetchPerformanceReviews, recalculatePerformance, resolvePerformanceAppeal,
  type CalibrationRow, type PerformanceKpi, type PerformanceReviewRow
} from '@/api/hr-approval'
import { createPerformanceFeedback, fetchPerformanceFeedbacks, type PerformanceFeedback } from '@/api/project-ops'

const rows = ref<Performance[]>([])
const kpis = ref<PerformanceKpi[]>([])
const reviews = ref<PerformanceReviewRow[]>([])
const calibrations = ref<CalibrationRow[]>([])
const feedbacks = ref<PerformanceFeedback[]>([])
const loading = ref(false)
const query = ref<CollabQuery>({ page: 1, pageSize: 20 })
const form = reactive({ employeeId: 0, period: '', score: 80 })
const kpiForm = reactive({ kpiCode: '', kpiName: '', category: 'GENERAL', weight: '0', targetValue: '0', unit: '' })
const calibrationForm = reactive({ period: '', calibrationDate: '', conclusion: '' })
const appealForm = reactive({ reviewId: 0, reason: '' })
const feedbackForm = reactive({ reviewId: 0, evaluatorId: 0, feedbackType: 'PEER', score: 80, comment: '' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const [performance, kpi, review, calibration] = await Promise.all([
      fetchPerformances(query.value), fetchPerformanceKpis(query.value),
      fetchPerformanceReviews(query.value), fetchCalibrations(query.value)
    ])
    if (current !== seq) return
    rows.value = performance.list
    kpis.value = kpi.list
    reviews.value = review.list
    calibrations.value = calibration.list
  } finally { if (current === seq) loading.value = false }
}
async function run(fn: () => Promise<unknown>, message: string): Promise<void> {
  try { await fn(); ElMessage.success(message); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '操作失败') }
}
async function loadFeedbacks(reviewId: number): Promise<void> {
  if (!reviewId) { feedbacks.value = []; return }
  feedbacks.value = await fetchPerformanceFeedbacks(reviewId)
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>绩效</h2><p>按期间记录员工评分和等级。</p></header>
    <el-tabs>
      <el-tab-pane label="绩效评分">
        <el-form inline>
          <el-form-item label="员工ID"><el-input-number v-model="form.employeeId" :min="1" /></el-form-item>
          <el-form-item label="期间"><el-date-picker v-model="form.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  /></el-form-item>
          <el-form-item label="评分"><el-input-number v-model="form.score" :min="0" :max="100" /></el-form-item>
          <el-button type="primary" v-perm="'hr:performance:create'" @click="run(() => createPerformance({ ...form }), '绩效已保存')">保存</el-button>
        </el-form>
        <el-table v-loading="loading" :data="rows" row-key="id" size="small">
          <el-table-column prop="employeeId" label="员工ID" width="110" />
          <el-table-column prop="period" label="期间" width="120" />
          <el-table-column prop="score" label="评分" width="100" />
          <el-table-column prop="level" label="等级" width="100" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="KPI 指标库">
        <el-form inline>
          <el-form-item label="编码"><el-input v-model="kpiForm.kpiCode" /></el-form-item>
          <el-form-item label="名称"><el-input v-model="kpiForm.kpiName" /></el-form-item>
          <el-form-item label="分类"><el-input v-model="kpiForm.category" /></el-form-item>
          <el-form-item label="权重"><el-input v-model="kpiForm.weight" /></el-form-item>
          <el-form-item label="目标值"><el-input v-model="kpiForm.targetValue" /></el-form-item>
          <el-form-item label="单位"><el-input v-model="kpiForm.unit" /></el-form-item>
          <el-button type="primary" v-perm="'hr:performance:create'" @click="run(() => createPerformanceKpi({ ...kpiForm }), 'KPI 已创建')">新增</el-button>
        </el-form>
        <el-table :data="kpis" row-key="id" size="small">
          <el-table-column prop="kpiCode" label="编码" width="150" />
          <el-table-column prop="kpiName" label="名称" min-width="180" />
          <el-table-column prop="category" label="分类" width="120" />
          <el-table-column prop="weight" label="权重" width="90" />
          <el-table-column prop="targetValue" label="目标值" width="120" />
          <el-table-column prop="unit" label="单位" width="90" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="360 反馈">
        <el-form inline>
          <el-form-item label="复核ID"><el-input-number v-model="feedbackForm.reviewId" :min="1" /></el-form-item>
          <el-form-item label="评价人ID"><el-input-number v-model="feedbackForm.evaluatorId" :min="1" /></el-form-item>
          <el-form-item label="类型"><el-input v-model="feedbackForm.feedbackType" /></el-form-item>
          <el-form-item label="得分"><el-input-number v-model="feedbackForm.score" :min="0" :max="100" /></el-form-item>
          <el-form-item label="评语"><el-input v-model="feedbackForm.comment" /></el-form-item>
          <el-button type="primary" v-perm="'hr:performance:create'" @click="run(() => createPerformanceFeedback(feedbackForm.reviewId, { ...feedbackForm }), '反馈已提交')">提交反馈</el-button>
          <el-button @click="loadFeedbacks(feedbackForm.reviewId)">查看反馈</el-button>
        </el-form>
        <el-table :data="feedbacks" row-key="id" size="small">
          <el-table-column prop="reviewId" label="复核ID" width="110" />
          <el-table-column prop="evaluatorId" label="评价人" width="110" />
          <el-table-column prop="feedbackType" label="类型" width="120" />
          <el-table-column prop="score" label="得分" width="100" />
          <el-table-column prop="comment" label="评语" min-width="200" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="复核与申诉">
        <el-form inline>
          <el-form-item label="复核ID"><el-input-number v-model="appealForm.reviewId" :min="1" /></el-form-item>
          <el-form-item label="申诉理由"><el-input v-model="appealForm.reason" /></el-form-item>
          <el-button type="primary" v-perm="'hr:performance:create'" @click="run(() => appealPerformance(appealForm.reviewId, appealForm.reason), '申诉已提交')">提交申诉</el-button>
        </el-form>
        <el-table :data="reviews" row-key="id" size="small">
          <el-table-column prop="employeeId" label="员工ID" width="110" />
          <el-table-column prop="period" label="期间" width="110" />
          <el-table-column prop="kpiScore" label="KPI" width="90" />
          <el-table-column prop="peerScore" label="同伴" width="90" />
          <el-table-column prop="calibration" label="校准" width="90" />
          <el-table-column prop="finalScore" label="综合" width="100" />
          <el-table-column prop="level" label="等级" width="90" />
          <el-table-column prop="appealStatus" label="申诉状态" width="110" />
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'hr:performance:approve'" @click="run(() => recalculatePerformance(row.id), '已按 360 反馈重算')">重算</el-button>
              <el-button link type="success" v-perm="'hr:performance:approve'" @click="run(() => resolvePerformanceAppeal(row.id, { result: 'ACCEPT' }), '申诉已受理')">受理</el-button>
              <el-button link type="danger" v-perm="'hr:performance:approve'" @click="run(() => resolvePerformanceAppeal(row.id, { result: 'REJECT' }), '申诉已驳回')">驳回</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="校准会议">
        <el-form inline>
          <el-form-item label="期间"><el-date-picker v-model="calibrationForm.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  /></el-form-item>
          <el-form-item label="日期"><el-date-picker v-model="calibrationForm.calibrationDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
          <el-form-item label="结论"><el-input v-model="calibrationForm.conclusion" /></el-form-item>
          <el-button type="primary" v-perm="'hr:performance:approve'" @click="run(() => createCalibration({ ...calibrationForm }), '校准会议已创建')">创建校准</el-button>
        </el-form>
        <el-table :data="calibrations" row-key="id" size="small">
          <el-table-column prop="period" label="期间" width="110" />
          <el-table-column prop="calibrationDate" label="日期" width="130" />
          <el-table-column prop="participantCount" label="参评人数" width="110" />
          <el-table-column prop="distribution" label="分布" min-width="260" />
          <el-table-column prop="conclusion" label="结论" min-width="200" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
</style>
