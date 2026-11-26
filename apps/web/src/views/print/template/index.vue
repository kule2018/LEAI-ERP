<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createPrintJob,
  copyTemplate,
  createTemplate,
  fetchPrintFields,
  fetchPrintRecords,
  fetchTemplates,
  fetchTemplateVersions,
  publishTemplate,
  type PrintFieldItem,
  type PrintRecord,
  type PrintTemplate
} from '@/api/print'
import type { PageQuery } from '@/types/contract'

const templates = ref<PrintTemplate[]>([])
const records = ref<PrintRecord[]>([])
const templateTotal = ref(0)
const recordTotal = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const dialogVisible = ref(false)
const form = reactive({
  code: '', name: '', bizType: '', paper: 'A4',
  body: '<h1>{{order.order_no}}</h1>', logoUrl: '', barcodeField: '', loopKey: ''
})
const jobForm = reactive({ bizType: '', bizId: 0, bizNo: '', templateCode: '', copies: 1, channel: 'SERVER_PDF' })
const versionDrawer = ref(false)
const versionCode = ref('')
const versions = ref<PrintTemplate[]>([])
const fields = ref<PrintFieldItem[]>([])
const fieldsLoading = ref(false)

/** 业务类型可选项（与后端字段目录保持一致） */
const bizTypeOptions = [
  { label: '销售订单', value: 'sale_order' },
  { label: '采购订单', value: 'purchase_order' },
  { label: '库存出入库', value: 'stock_io' },
  { label: '采购收货', value: 'goods_receipt' }
]

const fieldGroups = computed<{ label: string; group: string; items: PrintFieldItem[] }[]>(() => {
  const labels: Record<string, string> = { common: '通用字段', biz: '业务字段', custom: '自定义字段' }
  return ['common', 'biz', 'custom']
    .map((group) => ({
      label: labels[group] ?? group,
      group,
      items: fields.value.filter((item) => item.group === group)
    }))
    .filter((entry) => entry.items.length > 0)
})

async function loadFields(): Promise<void> {
  if (!form.bizType) {
    fields.value = []
    return
  }
  fieldsLoading.value = true
  try {
    fields.value = await fetchPrintFields(form.bizType)
  } catch {
    fields.value = []
  } finally {
    fieldsLoading.value = false
  }
}

/** 点击字段插入占位符 {{key}} 到正文模板 */
function insertField(field: PrintFieldItem): void {
  form.body = `${form.body}{{${field.key}}}`
}


let requestSeq = 0

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const [templateResult, recordResult] = await Promise.all([
      fetchTemplates(query.value),
      fetchPrintRecords(query.value)
    ])
    if (seq !== requestSeq) return
    templates.value = templateResult.list
    templateTotal.value = templateResult.total
    records.value = recordResult.list
    recordTotal.value = recordResult.total
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, {
    code: '', name: '', bizType: '', paper: 'A4',
    body: '<h1>{{order.order_no}}</h1>', logoUrl: '', barcodeField: '', loopKey: ''
  })
  fields.value = []
  dialogVisible.value = true
}

async function handleCreate(): Promise<void> {
  try {
    const schema: Record<string, unknown> = { body: form.body }
    if (form.logoUrl) schema.logoUrl = form.logoUrl
    if (form.barcodeField) schema.barcodeFields = [{ key: form.barcodeField, type: 'QR' }]
    if (form.loopKey) schema.loops = [{ key: form.loopKey, itemTemplate: `<p>{{${form.loopKey}.name}}</p>` }]
    await createTemplate({ code: form.code, name: form.name, bizType: form.bizType, paper: form.paper, schema })
    dialogVisible.value = false
    ElMessage.success('模板已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '创建失败')
  }
}

async function handlePublish(id: number): Promise<void> {
  try {
    await publishTemplate(id)
    ElMessage.success('模板已通过发布校验并启用')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '发布失败')
  }
}

async function handleCopy(id: number): Promise<void> {
  try {
    await copyTemplate(id)
    ElMessage.success('模板副本已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '复制失败')
  }
}

function selectTemplate(row: unknown): void {
  const template = row as PrintTemplate
  jobForm.bizType = template.bizType
  jobForm.templateCode = template.code
}

async function handlePrint(): Promise<void> {
  try {
    const record = await createPrintJob({
      bizType: jobForm.bizType,
      bizId: jobForm.bizId,
      bizNo: jobForm.bizNo,
      templateCode: jobForm.templateCode || undefined,
      copies: jobForm.copies,
      channel: jobForm.channel
    })
    ElMessage.success(`已创建打印记录：${record.templateCode}`)
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '打印失败')
  }
}

async function openVersions(row: unknown): Promise<void> {
  const template = row as PrintTemplate
  versionCode.value = template.code
  versionDrawer.value = true
  try {
    versions.value = await fetchTemplateVersions(template.code)
  } catch (cause) {
    versions.value = []
    ElMessage.error(cause instanceof Error ? cause.message : '加载版本历史失败')
  }
}

onMounted(load)
onUnmounted(() => {
  requestSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>打印模板</h2>
      <p>模板按业务类型匹配；打印任务生成后保留打印人、时间、份数和水印。</p>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="print-layout">
      <article class="panel">
        <div class="panel-toolbar">
          <el-input v-model="query.keyword" placeholder="搜索模板" clearable @keyup.enter="load" />
          <el-button type="primary" v-perm="'print:template:create'" @click="openCreate">新增模板</el-button>
          <el-button @click="load">刷新</el-button>
        </div>
        <el-table v-loading="loading" :data="templates" row-key="id" @row-click="selectTemplate">
          <el-table-column prop="code" label="模板编码" width="140" />
          <el-table-column prop="name" label="模板名称" min-width="140" />
          <el-table-column prop="bizType" label="业务类型" width="140" />
          <el-table-column prop="paper" label="纸张" width="80" />
          <el-table-column prop="version" label="版本" width="80" />
          <el-table-column label="操作" width="230">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'print:template:update'" @click.stop="handlePublish(Number(row.id))">发布</el-button>
              <el-button link type="warning" v-perm="'print:template:create'" @click.stop="handleCopy(Number(row.id))">复制</el-button>
              <el-button link type="info" @click.stop="openVersions(row)">版本时间线</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination">
          <el-pagination background layout="prev, pager, next" :total="templateTotal" :current-page="query.page" :page-size="query.pageSize" />
        </div>
      </article>

      <article class="panel">
        <h3>打印执行</h3>
        <el-form label-width="90px">
          <el-form-item label="业务类型"><el-input v-model="jobForm.bizType" /></el-form-item>
          <el-form-item label="业务ID"><el-input-number v-model="jobForm.bizId" :min="1" /></el-form-item>
          <el-form-item label="业务单号"><el-input v-model="jobForm.bizNo" /></el-form-item>
          <el-form-item label="模板编码"><el-input v-model="jobForm.templateCode" /></el-form-item>
          <el-form-item label="份数"><el-input-number v-model="jobForm.copies" :min="1" :max="10" /></el-form-item>
          <el-form-item label="通道">
            <el-select v-model="jobForm.channel">
              <el-option label="服务端 PDF" value="SERVER_PDF" />
              <el-option label="客户端" value="CLIENT" />
            </el-select>
          </el-form-item>
        </el-form>
        <el-button type="primary" v-perm="'print:job:create'" @click="handlePrint">生成打印任务</el-button>

        <h3 class="section-title">最近记录</h3>
        <el-table :data="records" row-key="id" size="small">
          <el-table-column prop="templateCode" label="模板" width="120" />
          <el-table-column prop="bizNo" label="业务单号" min-width="140" />
          <el-table-column prop="copies" label="份数" width="70" />
          <el-table-column prop="printedAt" label="时间" width="170" />
        </el-table>
      </article>
    </div>

    <el-drawer v-model="versionDrawer" :title="`模板版本时间线 - ${versionCode}`" size="420px">
      <el-timeline v-if="versions.length">
        <el-timeline-item
          v-for="item in versions"
          :key="item.id"
          :timestamp="item.updatedAt"
          placement="top"
        >
          <div>版本：v{{ item.version }}（{{ item.status }}）</div>
          <div>纸张：{{ item.paper }}</div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无版本记录" />
    </el-drawer>

    <el-dialog v-model="dialogVisible" title="新增打印模板" width="520px">
      <el-form label-width="90px">
        <el-form-item label="模板编码"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="模板名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="业务类型">
          <el-select v-model="form.bizType" filterable allow-create placeholder="选择业务类型" style="width: 100%" @change="loadFields">
            <el-option v-for="item in bizTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="纸张">
          <el-select v-model="form.paper">
            <el-option label="A4" value="A4" />
            <el-option label="A5" value="A5" />
            <el-option label="80mm" value="80mm" />
          </el-select>
        </el-form-item>
        <el-form-item label="正文模板"><el-input v-model="form.body" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="可用字段">
          <div v-loading="fieldsLoading" class="field-picker">
            <el-empty v-if="!fieldGroups.length" description="选择业务类型后加载可用字段" :image-size="60" />
            <div v-for="group in fieldGroups" :key="group.group" class="field-group">
              <div class="field-group-title">{{ group.label }}</div>
              <el-tag
                v-for="item in group.items"
                :key="item.key"
                class="field-tag"
                :type="group.group === 'custom' ? 'warning' : 'info'"
                effect="plain"
                @click="insertField(item)"
              >
                {{ item.label }}（{{ item.key }}）
              </el-tag>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="LOGO 地址"><el-input v-model="form.logoUrl" placeholder="/uploads/logo.png" /></el-form-item>
        <el-form-item label="二维码字段"><el-input v-model="form.barcodeField" placeholder="order.order_no" /></el-form-item>
        <el-form-item label="循环区字段"><el-input v-model="form.loopKey" placeholder="lines" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.print-layout {
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(360px, 0.8fr);
  gap: 16px;
}

.panel {
  min-width: 0;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.panel h3 {
  margin: 0 0 16px;
}

.section-title {
  margin-top: 24px !important;
}

.panel-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
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

.field-picker {
  width: 100%;
  max-height: 220px;
  overflow: auto;
  padding: 8px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.field-group + .field-group {
  margin-top: 8px;
}

.field-group-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.field-tag {
  cursor: pointer;
  margin: 0 6px 6px 0;
}

@media (max-width: 1100px) {
  .print-layout {
    grid-template-columns: 1fr;
  }
}
</style>
