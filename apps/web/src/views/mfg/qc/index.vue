<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createQc, fetchQcs, type ManufacturingQuery, type Qc } from '@/api/manufacturing'

const rows = ref<Qc[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<ManufacturingQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ bizType: 'WORK_ORDER_COMPLETE', bizId: 0, inspectionType: 'FINAL', sampleQty: '1', defectQty: '0', result: 'PASS' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchQcs(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { bizType: 'WORK_ORDER_COMPLETE', bizId: 0, inspectionType: 'FINAL', sampleQty: '1', defectQty: '0', result: 'PASS' }); visible.value = true }
async function save(): Promise<void> {
  try { await createQc({ ...form }); visible.value = false; ElMessage.success('质检记录已保存'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>生产质检</h2><p>来料检、过程检和成品检；不合格成品检将冻结对应库存。</p></header>
    <article class="panel">
      <div class="toolbar"><el-button type="primary" v-perm="'mfg:qc:create'" @click="openAdd">新增检验</el-button><el-button @click="load">刷新</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="bizType" label="业务类型" width="200" />
        <el-table-column prop="bizId" label="业务ID" width="110" />
        <el-table-column prop="inspectionType" label="检验类型" width="130" />
        <el-table-column prop="sampleQty" label="抽样量" width="110" />
        <el-table-column prop="defectQty" label="不良量" width="110" />
        <el-table-column prop="result" label="结果" width="110" />
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
    <el-dialog v-model="visible" title="新增质检记录" width="560px">
      <el-form label-width="90px">
        <el-form-item label="业务类型"><el-input v-model="form.bizType" /></el-form-item>
        <el-form-item label="业务ID"><el-input-number v-model="form.bizId" :min="1" /></el-form-item>
        <el-form-item label="检验类型"><el-input v-model="form.inspectionType" /></el-form-item>
        <el-form-item label="抽样量"><el-input v-model="form.sampleQty" /></el-form-item>
        <el-form-item label="不良量"><el-input v-model="form.defectQty" /></el-form-item>
        <el-form-item label="结果"><el-select v-model="form.result"><el-option label="合格" value="PASS" /><el-option label="不合格" value="FAIL" /><el-option label="让步接收" value="CONCESSION" /></el-select></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
