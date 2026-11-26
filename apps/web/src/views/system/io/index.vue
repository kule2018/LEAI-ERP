<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  commitImport,
  createExportJob,
  fetchImportConfigs,
  fetchImportMappings,
  fetchIoJobs,
  previewImport,
  saveImportMappings,
  templateUrl,
  type ImportConfigItem,
  type ImportMapping,
  type ImportPreview,
  type ImportResult,
  type IoJob
} from '@/api/io'

const configs = ref<ImportConfigItem[]>([])
const selected = ref('')
const loading = ref(false)
const preview = ref<ImportPreview | null>(null)
const result = ref<ImportResult | null>(null)
const fileName = ref('')
const jobs = ref<IoJob[]>([])

const currentConfig = () => configs.value.find((item) => item.code === selected.value)

async function loadConfigs(): Promise<void> {
  try {
    configs.value = await fetchImportConfigs()
    if (!selected.value && configs.value.length) selected.value = configs.value[0].code
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载导入配置失败')
  }
}

async function loadJobs(): Promise<void> {
  try {
    const page = await fetchIoJobs({ page: 1, pageSize: 10 })
    jobs.value = page.list
  } catch {
    jobs.value = []
  }
}

function onFileChange(file: { raw: File }): void {
  const raw = file.raw
  if (!raw) return
  if (!/\.csv$/i.test(raw.name)) {
    ElMessage.warning('当前仅支持 CSV 文件，请使用模板填写')
    return
  }
  fileName.value = raw.name
  preview.value = null
  result.value = null
  pendingContent.value = ''
  const reader = new FileReader()
  reader.onload = () => {
    const content = String(reader.result ?? '')
    pendingContent.value = content
    void runPreview(content)
  }
  reader.readAsText(raw, 'UTF-8')
}

async function runPreview(content: string): Promise<void> {
  if (!selected.value) return
  loading.value = true
  try {
    preview.value = await previewImport(selected.value, content)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '校验失败')
  } finally {
    loading.value = false
  }
}

async function commit(): Promise<void> {
  if (!preview.value || preview.value.invalid > 0) {
    ElMessage.warning('请先修正错误行，全部校验通过后方可导入')
    return
  }
  const content = pendingContent.value
  if (!content) return
  loading.value = true
  try {
    result.value = await commitImport(selected.value, content)
    ElMessage.success(`导入完成：成功 ${result.value.imported}，跳过 ${result.value.skipped}`)
    preview.value = null
    pendingContent.value = ''
    fileName.value = ''
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '导入失败')
  } finally {
    loading.value = false
  }
}

const pendingContent = ref('')

async function exportData(): Promise<void> {
  if (!selected.value) return
  try {
    await createExportJob(selected.value)
    ElMessage.success('导出任务已创建')
    await loadJobs()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '创建导出任务失败')
  }
}

/* ---------- 字段映射 ---------- */
const mappingVisible = ref(false)
const mappingHeaders = ref<string[]>([])
const mappingRows = ref<ImportMapping[]>([])

async function openMapping(): Promise<void> {
  if (!selected.value) return
  try {
    const info = await fetchImportMappings(selected.value)
    mappingHeaders.value = info.headers
    mappingRows.value = info.mappings.length
      ? info.mappings
      : info.headers.map((header) => ({ sourceHeader: '', targetHeader: header }))
    mappingVisible.value = true
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '读取字段映射失败')
  }
}

function addMappingRow(): void {
  mappingRows.value.push({ sourceHeader: '', targetHeader: mappingHeaders.value[0] ?? '' })
}

async function saveMapping(): Promise<void> {
  if (!selected.value) return
  const mappings = mappingRows.value.filter((row) => row.sourceHeader.trim() && row.targetHeader)
  try {
    await saveImportMappings(selected.value, mappings)
    ElMessage.success('字段映射已保存')
    mappingVisible.value = false
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存字段映射失败')
  }
}

onMounted(() => {
  void loadConfigs()
  void loadJobs()
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>导入导出</h2>
      <p>下载模板填写后上传预览，校验通过的事务导入才会落库；错误行整批拦截。导出任务异步记录。</p>
    </header>

    <div class="io-layout">
      <article class="panel resources">
        <h3>导入资源</h3>
        <el-radio-group v-model="selected" class="resource-list">
          <el-radio v-for="item in configs" :key="item.code" :value="item.code" border>
            {{ item.name }}（{{ item.code }}）
          </el-radio>
        </el-radio-group>
        <div class="template-area" v-if="currentConfig">
          <p class="hint">模板列：{{ currentConfig()?.headers.join(' / ') }}</p>
          <el-link :href="templateUrl(selected)" type="primary" target="_blank">下载 CSV 模板</el-link>
        </div>
        <el-divider />
        <el-button plain v-perm="'system:io:import'" @click="openMapping">字段映射</el-button>
        <el-button type="primary" plain v-perm="'system:io:export'" @click="exportData">创建导出任务</el-button>
      </article>

      <article class="panel workspace">
        <h3>导入文件</h3>
        <el-upload
          :auto-upload="false"
          :show-file-list="true"
          accept=".csv"
          :on-change="onFileChange"
        >
          <el-button type="primary">选择 CSV 文件</el-button>
        </el-upload>
        <p class="hint">{{ fileName ? `已选择：${fileName}` : '请先下载模板，按列填写后上传。' }}</p>

        <template v-if="preview">
          <el-alert
            :title="`校验结果：共 ${preview.total} 行，有效 ${preview.valid} 行，错误 ${preview.invalid} 行`"
            :type="preview.invalid > 0 ? 'error' : 'success'"
            show-icon
            class="preview-alert"
          />
          <el-table :data="preview.issues" size="small" max-height="240" v-if="preview.issues.length">
            <el-table-column prop="row" label="行号" width="80" />
            <el-table-column prop="field" label="字段" width="160" />
            <el-table-column prop="message" label="问题" min-width="200" />
          </el-table>
          <div class="commit-area">
            <el-button type="primary" v-perm="'system:io:import'" :disabled="preview.invalid > 0 || loading" @click="commit">
              确认导入 {{ preview.valid }} 行
            </el-button>
          </div>
        </template>

        <el-alert
          v-if="result"
          :title="`导入完成：成功 ${result.imported}，跳过 ${result.skipped}，共 ${result.total} 行`"
          type="success"
          show-icon
          class="preview-alert"
        />
      </article>
    </div>

    <article class="panel jobs">
      <h3>导出任务</h3>
      <el-table :data="jobs" size="small">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="code" label="资源" width="140" />
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column prop="finishedAt" label="完成时间" min-width="170" />
      </el-table>
    </article>

    <el-dialog v-model="mappingVisible" title="字段映射" width="640px">
      <p class="hint">将上传文件的列名映射到模板标准表头，导入时自动按映射重命名列。</p>
      <el-table :data="mappingRows" size="small" class="mapping-table">
        <el-table-column label="上传文件列名" min-width="200">
          <template #default="{ row }">
            <el-input v-model="row.sourceHeader" placeholder="例如：客户名称" />
          </template>
        </el-table-column>
        <el-table-column label="模板标准表头" min-width="200">
          <template #default="{ row }">
            <el-select v-model="row.targetHeader" placeholder="选择目标列">
              <el-option v-for="header in mappingHeaders" :key="header" :label="header" :value="header" />
            </el-select>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="mappingVisible = false">取消</el-button>
        <el-button @click="addMappingRow">新增一行</el-button>
        <el-button type="primary" v-perm="'system:io:import'" @click="saveMapping">保存映射</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.io-layout { display: grid; grid-template-columns: 280px 1fr; gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin: 0 0 12px; font-size: 15px; }
.resource-list { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.template-area { margin-top: 16px; }
.hint { color: #909399; font-size: 12px; line-height: 1.6; }
.preview-alert { margin: 16px 0; }
.commit-area { margin-top: 16px; }
.jobs { margin-top: 16px; }
</style>
