<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  approveOffer,
  fetchOffers,
  fetchRecruitPipeline,
  moveCandidateStage,
  rejectOffer,
  talentAction,
  type Offer,
  type PipelineCandidate,
  type PipelineColumn
} from '@/api/project-ops'

const columns = ref<PipelineColumn[]>([])
const offers = ref<Offer[]>([])
const tab = ref<'pipeline' | 'talent' | 'offer'>('pipeline')
const offerForm = reactive({ comment: '' })

const STAGE_LABELS: Record<string, string> = {
  APPLIED: '已投递',
  SCREENING: '初筛',
  INTERVIEW: '面试中',
  ASSESSMENT: '评估',
  OFFER: 'Offer',
  HIRED: '已入职',
  REJECTED: '已淘汰',
  TALENT: '人才库'
}

const NEXT_STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'HIRED', 'REJECTED', 'TALENT']

const talentCandidates = computed<PipelineCandidate[]>(() =>
  columns.value.filter((item) => item.stage === 'TALENT').flatMap((item) => item.candidates)
)

function fail(cause: unknown): void {
  ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
}

async function loadPipeline(): Promise<void> {
  try {
    columns.value = await fetchRecruitPipeline({ page: 1, pageSize: 200 })
  } catch (cause) {
    fail(cause)
  }
}

async function loadOffers(): Promise<void> {
  try {
    const result = await fetchOffers({ page: 1, pageSize: 100 })
    offers.value = result.list
  } catch (cause) {
    fail(cause)
  }
}

async function refresh(): Promise<void> {
  await Promise.all([loadPipeline(), loadOffers()])
}

async function moveStage(candidateId: number, stage: string): Promise<void> {
  try {
    await moveCandidateStage(candidateId, { stage })
    ElMessage.success('阶段已流转')
    await loadPipeline()
  } catch (cause) {
    fail(cause)
  }
}

async function talent(candidateId: number, action: 'IN' | 'REUSE' | 'DISCARD'): Promise<void> {
  try {
    await talentAction(candidateId, { action })
    ElMessage.success('人才库操作成功')
    await loadPipeline()
  } catch (cause) {
    fail(cause)
  }
}

async function handleOffer(row: Offer, action: 'APPROVE' | 'REJECT'): Promise<void> {
  try {
    if (action === 'APPROVE') await approveOffer(row.id, { comment: offerForm.comment || undefined })
    else await rejectOffer(row.id, { comment: offerForm.comment || undefined })
    ElMessage.success(action === 'APPROVE' ? 'Offer 已通过' : 'Offer 已驳回')
    await loadOffers()
  } catch (cause) {
    fail(cause)
  }
}

onMounted(refresh)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>招聘管道与人才库</h2>
      <p>候选人阶段流转、面试反馈校验、人才库入池与 Offer 审批。</p>
    </header>

    <article class="panel">
      <el-tabs v-model="tab">
        <el-tab-pane label="招聘管道" name="pipeline">
          <div class="pipeline">
            <div v-for="column in columns" :key="column.stage" class="pipeline-column">
              <header>{{ STAGE_LABELS[column.stage] ?? column.stage }}（{{ column.count }}）</header>
              <div v-for="candidate in column.candidates" :key="candidate.id" class="candidate-card">
                <div class="card-title">{{ candidate.name }}</div>
                <div class="card-meta">{{ candidate.phone ?? '无联系方式' }}</div>
                <div class="card-actions">
                  <el-select
                    :model-value="candidate.stage"
                    size="small"
                    style="width: 110px"
                    @change="(value: string) => moveStage(candidate.id, value)"
                  >
                    <el-option v-for="stage in NEXT_STAGES" :key="stage" :label="STAGE_LABELS[stage] ?? stage" :value="stage" />
                  </el-select>
                  <el-button link size="small" v-perm="'hr:recruit:create'" @click="talent(candidate.id, 'IN')">入人才库</el-button>
                  <el-button v-if="candidate.stage === 'TALENT'" link size="small" v-perm="'hr:recruit:create'" @click="talent(candidate.id, 'REUSE')">复用</el-button>
                  <el-button v-if="candidate.stage === 'TALENT'" link size="small" type="danger" v-perm="'hr:recruit:create'" @click="talent(candidate.id, 'DISCARD')">淘汰</el-button>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="人才库" name="talent">
          <el-table :data="talentCandidates" size="small" row-key="id">
            <el-table-column prop="id" label="候选人ID" width="110" />
            <el-table-column prop="name" label="姓名" min-width="160" />
            <el-table-column prop="phone" label="联系方式" min-width="160" />
            <el-table-column label="操作" width="160">
              <template #default="{ row }">
                <el-button link type="primary" v-perm="'hr:recruit:create'" @click="talent(row.id, 'REUSE')">复用</el-button>
                <el-button link type="danger" v-perm="'hr:recruit:create'" @click="talent(row.id, 'DISCARD')">淘汰</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="Offer 审批" name="offer">
          <el-form inline>
            <el-form-item label="审批意见"><el-input v-model="offerForm.comment" style="width: 220px" /></el-form-item>
          </el-form>
          <el-table :data="offers" size="small" row-key="id">
            <el-table-column prop="id" label="OfferID" width="100" />
            <el-table-column prop="candidateId" label="候选人" width="110" />
            <el-table-column prop="salary" label="薪资" width="140" />
            <el-table-column prop="status" label="状态" width="110" />
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button link type="primary" v-perm="'hr:recruit:approve'" @click="handleOffer(row, 'APPROVE')">通过</el-button>
                <el-button link type="danger" v-perm="'hr:recruit:approve'" @click="handleOffer(row, 'REJECT')">驳回</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.pipeline { display: flex; gap: 12px; overflow-x: auto; }
.pipeline-column { min-width: 220px; background: #f5f7fa; border-radius: 6px; padding: 8px; }
.pipeline-column header { font-weight: 600; margin-bottom: 8px; }
.candidate-card { background: #fff; border-radius: 4px; padding: 8px; margin-bottom: 8px; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06); }
.card-title { font-size: 14px; }
.card-meta { font-size: 12px; color: #909399; margin: 4px 0; }
.card-actions { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
</style>
