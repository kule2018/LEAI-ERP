<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createSubject, fetchSubjects, mergeSubjects, updateSubject, type FinanceQuery, type Subject } from '@/api/finance'

const rows = ref<Subject[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<FinanceQuery>({ page: 1, pageSize: 200, keyword: '' })
const visible = ref(false)
const form = reactive({ subjectCode: '', subjectName: '', parentId: 0, category: 'ASSET', direction: 'DEBIT', auxType: '' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchSubjects(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { subjectCode: '', subjectName: '', parentId: 0, category: 'ASSET', direction: 'DEBIT', auxType: '' }); visible.value = true }
async function save(): Promise<void> {
  try {
    await createSubject({ ...form, parentId: form.parentId || undefined, auxType: form.auxType || undefined })
    visible.value = false
    ElMessage.success('科目已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function handleToggleStatus(row: unknown): Promise<void> {
  const item = row as Subject
  const next = item.status === 'DISABLED' ? 'ENABLED' : 'DISABLED'
  try {
    if (next === 'DISABLED') {
      const { value } = await ElMessageBox.prompt('停用前请确认科目余额已结平，输入停用原因', `停用科目 ${item.subjectCode}`, {
        inputPlaceholder: '如：科目废弃'
      })
      await updateSubject(item.id, { status: 'DISABLED', disableReason: value })
    } else {
      await updateSubject(item.id, { status: 'ENABLED' })
    }
    ElMessage.success(next === 'DISABLED' ? '科目已停用' : '科目已启用')
    await load()
  } catch (cause) {
    if (cause === 'cancel' || cause === 'close') return
    ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
  }
}
async function handleMerge(row: unknown): Promise<void> {
  const source = row as Subject
  const targets = rows.value.filter((item) => item.id !== source.id && item.category === source.category && item.status !== 'MERGED')
  if (targets.length === 0) { ElMessage.warning('没有可合并的目标科目'); return }
  try {
    const { value } = await ElMessageBox.prompt(`请输入目标科目 ID（可选：${targets.slice(0, 5).map((item) => item.subjectCode).join(', ')}）`, `合并科目 ${source.subjectCode}`, {
      inputPattern: /^\d+$/,
      inputErrorMessage: '请输入数字科目 ID'
    })
    const result = await mergeSubjects({ sourceSubjectId: source.id, targetSubjectId: Number(value) })
    ElMessage.success(`已合并，迁移分录 ${result.migratedEntryCount} 条，合并后余额 ${result.mergedBalance}`)
    await load()
  } catch (cause) {
    if (cause === 'cancel' || cause === 'close') return
    ElMessage.error(cause instanceof Error ? cause.message : '合并失败')
  }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>会计科目</h2><p>科目表、余额方向和辅助核算配置。</p></header>
    <article class="panel">
      <div class="toolbar"><el-button type="primary" v-perm="'finance:subject:create'" @click="openAdd">新增科目</el-button><el-button @click="load">刷新</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="id" size="small">
        <el-table-column prop="subjectCode" label="科目编码" width="150" />
        <el-table-column prop="subjectName" label="科目名称" min-width="180" />
        <el-table-column prop="parentId" label="上级ID" width="110" />
        <el-table-column prop="category" label="类别" width="120" />
        <el-table-column prop="direction" label="方向" width="100" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column label="操作" width="170">
          <template #default="{ row }">
            <el-button link type="warning" :disabled="row.status === 'MERGED'" v-perm="'finance:subject:update'" @click="handleToggleStatus(row)">
              {{ row.status === 'DISABLED' ? '启用' : '停用' }}
            </el-button>
            <el-button link type="danger" :disabled="row.status === 'MERGED'" v-perm="'finance:subject:merge'" @click="handleMerge(row)">合并</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>
    <el-dialog v-model="visible" title="新增会计科目" width="520px">
      <el-form label-width="90px">
        <el-form-item label="编码"><el-input v-model="form.subjectCode" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.subjectName" /></el-form-item>
        <el-form-item label="上级ID"><el-input-number v-model="form.parentId" :min="0" /></el-form-item>
        <el-form-item label="类别">
          <el-select v-model="form.category"><el-option label="资产" value="ASSET" /><el-option label="负债" value="LIABILITY" /><el-option label="权益" value="EQUITY" /><el-option label="收入" value="INCOME" /><el-option label="费用" value="EXPENSE" /></el-select>
        </el-form-item>
        <el-form-item label="方向"><el-select v-model="form.direction"><el-option label="借" value="DEBIT" /><el-option label="贷" value="CREDIT" /></el-select></el-form-item>
        <el-form-item label="辅助核算"><el-input v-model="form.auxType" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
