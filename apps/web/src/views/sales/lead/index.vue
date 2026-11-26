<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { convertLead, createFollow, createLead, fetchFollows, fetchLeads, updateLead, type Lead } from '@/api/sales'

const stages = [
  { label: '新线索', value: 'NEW' },
  { label: '跟进中', value: 'FOLLOWING' },
  { label: '已验证', value: 'QUALIFIED' },
  { label: '已转化', value: 'CONVERTED' },
  { label: '已流失', value: 'LOST' }
]
const rows = ref<Lead[]>([])
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const dialogVisible = ref(false)
const followVisible = ref(false)
const editingId = ref(0)
const followTarget = ref<Lead | null>(null)
const form = reactive({ name: '', phone: '', source: '', score: 0 })
const followForm = reactive({ content: '', followType: 'NOTE' })

let requestSeq = 0

const grouped = computed(() => stages.map((stage) => ({
  ...stage,
  items: rows.value.filter((row) => row.status === stage.value)
})))

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchLeads({ page: 1, pageSize: 200, keyword: keyword.value })
    if (seq !== requestSeq) return
    rows.value = result.list
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function openAdd(): void {
  editingId.value = 0
  form.name = ''
  form.phone = ''
  form.source = ''
  form.score = 0
  dialogVisible.value = true
}

function openEdit(row: unknown): void {
  const lead = row as Lead
  editingId.value = lead.id
  form.name = lead.name
  form.phone = lead.phone ?? ''
  form.source = lead.source ?? ''
  form.score = lead.score
  dialogVisible.value = true
}

async function saveLead(): Promise<void> {
  try {
    if (editingId.value > 0) {
      await updateLead(editingId.value, { ...form })
    } else {
      await createLead({ ...form })
    }
    dialogVisible.value = false
    ElMessage.success('保存成功')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function handleConvert(row: unknown): Promise<void> {
  const lead = row as Lead
  if (lead.status === 'CONVERTED') return
  try {
    await convertLead(lead.id)
    ElMessage.success('已转化为客户')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '转化失败')
  }
}

function openFollow(row: unknown): void {
  followTarget.value = row as Lead
  followForm.content = ''
  followForm.followType = 'NOTE'
  followVisible.value = true
}

async function saveFollow(): Promise<void> {
  if (!followTarget.value) return
  try {
    await createFollow({
      bizType: 'lead',
      bizId: followTarget.value.id,
      content: followForm.content,
      followType: followForm.followType
    })
    await fetchFollows('lead', followTarget.value.id)
    followVisible.value = false
    ElMessage.success('跟进已记录')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

onMounted(load)
onUnmounted(() => { requestSeq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>线索池</h2>
      <p>线索评分、阶段推进、重复检测和转化；已转化线索会生成客户档案。</p>
    </header>

    <div class="toolbar">
      <el-input v-model="keyword" placeholder="搜索线索" clearable @keyup.enter="load" />
      <el-button type="primary" v-perm="'sales:lead:create'" @click="openAdd">新增线索</el-button>
      <el-button @click="load">刷新</el-button>
      <span v-if="error" class="error">{{ error }}</span>
    </div>

    <div v-loading="loading" class="kanban">
      <section v-for="stage in grouped" :key="stage.value" class="kanban-column">
        <header>{{ stage.label }} <span>{{ stage.items.length }}</span></header>
        <el-card v-for="lead in stage.items" :key="lead.id" shadow="hover" class="lead-card">
          <div class="lead-title">{{ lead.name }}</div>
          <div class="lead-meta">{{ lead.leadNo }} · 评分 {{ lead.score }}</div>
          <div class="lead-actions">
            <el-button link type="primary" v-perm="'sales:lead:update'" @click="openEdit(lead)">编辑</el-button>
            <el-button link type="primary" @click="openFollow(lead)">跟进</el-button>
            <el-button link type="success" v-perm="'sales:lead:convert'" :disabled="lead.status === 'CONVERTED'" @click="handleConvert(lead)">转化</el-button>
          </div>
        </el-card>
      </section>
    </div>

    <el-dialog v-model="dialogVisible" title="线索" width="520px">
      <el-form label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="来源"><el-input v-model="form.source" /></el-form-item>
        <el-form-item label="评分"><el-input-number v-model="form.score" :min="0" :max="100" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveLead">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="followVisible" title="记录跟进" width="520px">
      <el-form label-width="80px">
        <el-form-item label="方式">
          <el-select v-model="followForm.followType">
            <el-option label="电话" value="CALL" />
            <el-option label="拜访" value="VISIT" />
            <el-option label="备注" value="NOTE" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容"><el-input v-model="followForm.content" type="textarea" :rows="4" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="followVisible = false">取消</el-button>
        <el-button type="primary" @click="saveFollow">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; }
.error { color: #f5222d; }
.kanban { display: grid; grid-template-columns: repeat(5, minmax(200px, 1fr)); gap: 12px; }
.kanban-column { min-height: 480px; padding: 12px; background: #f0f2f5; border-radius: 8px; }
.kanban-column header { display: flex; justify-content: space-between; margin-bottom: 12px; font-weight: 600; }
.lead-card { margin-bottom: 10px; }
.lead-title { font-weight: 600; }
.lead-meta { margin: 6px 0; color: #646a73; font-size: 12px; }
.lead-actions { display: flex; flex-wrap: wrap; gap: 4px; }
@media (max-width: 1200px) { .kanban { grid-template-columns: repeat(2, minmax(220px, 1fr)); } }
</style>
