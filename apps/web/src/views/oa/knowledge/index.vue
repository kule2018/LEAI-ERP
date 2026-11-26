<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createDocument, fetchDocuments, type CollabQuery, type Document } from '@/api/collaboration'

const rows = ref<Document[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<CollabQuery>({ page: 1, pageSize: 20 })
const visible = ref(false)
const form = reactive({ docCode: '', title: '', fileUrl: '' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchDocuments(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { docCode: '', title: '', fileUrl: '' }); visible.value = true }
async function save(): Promise<void> {
  try {
    await createDocument({ ...form, fileUrl: form.fileUrl || undefined })
    visible.value = false
    ElMessage.success('文档已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>文档知识库</h2><p>文档台账与版本记录，后续接入 RAG 引用。</p></header>
    <article class="panel">
      <div class="toolbar"><el-button type="primary" v-perm="'oa:document:create'" @click="openAdd">新增文档</el-button><el-button @click="load">刷新</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="docCode" label="文档编码" width="150" />
        <el-table-column prop="title" label="标题" min-width="220" />
        <el-table-column prop="version" label="版本" width="90" />
        <el-table-column prop="status" label="状态" width="110" />
      </el-table>
    </article>
    <el-dialog v-model="visible" title="新增文档" width="560px">
      <el-form label-width="90px">
        <el-form-item label="文档编码"><el-input v-model="form.docCode" /></el-form-item>
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="文件地址"><el-input v-model="form.fileUrl" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
