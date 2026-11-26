<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchFiles, uploadFile, type FileRecord } from '@/api/file'
import type { PageQuery } from '@/types/contract'

const rows = ref<FileRecord[]>([])
const total = ref(0)
const loading = ref(false)
const uploading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const fileInput = ref<HTMLInputElement | null>(null)
const previewUrl = ref('')
const previewVisible = ref(false)

let requestSeq = 0

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchFiles(query.value)
    if (seq !== requestSeq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function handleUpload(): Promise<void> {
  const input = fileInput.value
  const file = input?.files?.[0]
  if (!file) {
    ElMessage.warning('请先选择文件')
    return
  }
  uploading.value = true
  try {
    await uploadFile(file)
    ElMessage.success('上传成功')
    if (input) input.value = ''
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '上传失败')
  } finally {
    uploading.value = false
  }
}

function formattedSize(row: unknown): string {
  return formatSize((row as FileRecord).sizeBytes)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isImage(row: unknown): boolean {
  const file = row as FileRecord
  return Boolean(file.mimeType?.startsWith('image/'))
}

function openPreview(row: unknown): void {
  const file = row as FileRecord
  if (!isImage(file) || !file.url) return
  previewUrl.value = file.url
  previewVisible.value = true
}

onMounted(load)
onUnmounted(() => {
  requestSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>文件存储</h2>
      <p>本地存储网关：上传文件落盘后写入元数据，静态地址通过 /uploads 对外提供。</p>
    </header>

    <article class="file-panel">
      <div class="upload-bar">
        <input ref="fileInput" type="file" class="file-input" />
        <el-button type="primary" :loading="uploading" v-perm="'system:file:upload'" @click="handleUpload">上传</el-button>
        <el-input v-model="query.keyword" placeholder="搜索文件名" clearable @keyup.enter="load" />
        <el-button @click="load">刷新</el-button>
      </div>

      <div v-if="error" class="error-banner">{{ error }}</div>

      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="fileName" label="文件名" min-width="200" show-overflow-tooltip />
        <el-table-column prop="mimeType" label="类型" width="160" />
        <el-table-column label="大小" width="100">
          <template #default="{ row }">{{ formattedSize(row) }}</template>
        </el-table-column>
        <el-table-column prop="storageDriver" label="存储" width="100" />
        <el-table-column prop="createdAt" label="上传时间" width="180" />
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="!isImage(row)" @click="openPreview(row)">预览</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="total"
          :current-page="query.page"
          :page-size="query.pageSize"
          @current-change="(value: number) => { query.page = value; void load() }"
        />
      </div>
    </article>

    <el-dialog v-model="previewVisible" title="文件预览" width="720px">
      <el-image v-if="previewUrl" :src="previewUrl" fit="contain" style="width: 100%; min-height: 320px" />
    </el-dialog>
  </section>
</template>

<style scoped>
.file-panel {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.upload-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.file-input {
  max-width: 280px;
}

.error-banner {
  margin-bottom: 16px;
  padding: 12px 16px;
  color: #f5222d;
  background: #fff1f0;
  border-radius: 8px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
