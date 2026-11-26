<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createNotice, fetchNotices, type CollabQuery, type Notice } from '@/api/collaboration'

const rows = ref<Notice[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<CollabQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ title: '', content: '', channel: 'INMAIL' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchNotices(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { title: '', content: '', channel: 'INMAIL' }); visible.value = true }
async function save(): Promise<void> {
  try { await createNotice({ ...form }); visible.value = false; ElMessage.success('公告已创建'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>公告</h2><p>企业公告发布与频道管理。</p></header>
    <article class="panel">
      <div class="toolbar"><el-button type="primary" v-perm="'oa:notice:create'" @click="openAdd">发布公告</el-button><el-button @click="load">刷新</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="title" label="标题" min-width="220" />
        <el-table-column prop="channel" label="通道" width="120" />
        <el-table-column prop="publishedFlag" label="发布" width="100" />
        <el-table-column prop="createdAt" label="创建时间" width="180" />
      </el-table>
    </article>
    <el-dialog v-model="visible" title="发布公告" width="600px">
      <el-form label-width="80px">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="5" /></el-form-item>
        <el-form-item label="通道"><el-input v-model="form.channel" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
