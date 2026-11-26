<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  batchPrintJobs,
  createSilentPrintJob,
  fetchPrintRecords,
  fetchTemplates,
  previewPrintTemplate,
  reprintPrintRecord,
  type PrintTemplate
} from '@/api/print'

const templates = ref<PrintTemplate[]>([])
const records = ref<Array<Record<string, unknown>>>([])
const selectedTemplateId = ref<number | null>(null)
const previewText = ref('')
const form = reactive({ bizType: 'sale_order', bizId: 0, bizNo: '', copies: 1, templateCode: '' })
const reprintId = ref<number | null>(null)

async function load(): Promise<void> {
  const result = await fetchTemplates({ page: 1, pageSize: 50 })
  templates.value = result.list
  if (!selectedTemplateId.value && templates.value.length > 0) selectedTemplateId.value = templates.value[0].id
  form.templateCode = templates.value.find((item) => item.id === selectedTemplateId.value)?.code ?? ''
  const recordResult = await fetchPrintRecords({ page: 1, pageSize: 20 })
  records.value = recordResult.list as unknown as Array<Record<string, unknown>>
}

async function preview(): Promise<void> {
  if (!selectedTemplateId.value) return
  const result = await previewPrintTemplate(selectedTemplateId.value)
  previewText.value = JSON.stringify(result, null, 2)
}

function jobData() {
  return {
    bizType: form.bizType,
    bizId: Number(form.bizId),
    bizNo: form.bizNo,
    templateCode: form.templateCode || undefined,
    copies: Number(form.copies)
  }
}

async function batch(): Promise<void> {
  await batchPrintJobs([jobData()])
  ElMessage.success('批量打印任务已创建')
  await load()
}

async function silent(): Promise<void> {
  await createSilentPrintJob(jobData())
  ElMessage.success('静默打印任务已创建')
  await load()
}

async function reprint(): Promise<void> {
  if (!reprintId.value) {
    ElMessage.warning('请填写打印记录ID')
    return
  }
  await reprintPrintRecord(reprintId.value)
  ElMessage.success('补打任务已创建')
  await load()
}

onMounted(load)
</script>

<template>
  <div class="print-center">
    <el-card shadow="never">
      <template #header><span class="title">打印执行中心</span></template>
      <p class="desc">模板预览、批量打印、静默打印与补打入口；所有打印记录留痕并支持水印。</p>
      <div class="grid">
        <div>
          <el-form label-width="90px" size="small">
            <el-form-item label="打印模板">
              <el-select v-model="selectedTemplateId" @change="form.templateCode = templates.find(t => t.id === selectedTemplateId)?.code ?? ''">
                <el-option v-for="item in templates" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="业务类型"><el-input v-model="form.bizType" /></el-form-item>
            <el-form-item label="业务ID"><el-input-number v-model="form.bizId" :min="0" /></el-form-item>
            <el-form-item label="业务单号"><el-input v-model="form.bizNo" /></el-form-item>
            <el-form-item label="份数"><el-input-number v-model="form.copies" :min="1" /></el-form-item>
            <el-form-item>
              <el-button size="small" @click="preview">模板预览</el-button>
              <el-button type="primary" size="small" @click="batch">批量打印</el-button>
              <el-button size="small" @click="silent">静默打印</el-button>
            </el-form-item>
            <el-form-item label="补打记录">
              <el-input-number v-model="reprintId" :min="0" placeholder="打印记录ID" />
              <el-button size="small" @click="reprint">补打</el-button>
            </el-form-item>
          </el-form>
        </div>
        <div>
          <el-alert v-if="previewText" type="info" :closable="false" title="模板预览结果" />
          <pre class="preview">{{ previewText }}</pre>
        </div>
      </div>
      <el-table :data="records" size="small" border>
        <el-table-column prop="id" label="记录ID" width="90" />
        <el-table-column prop="bizNo" label="业务单号" width="140" />
        <el-table-column prop="channel" label="通道" width="110" />
        <el-table-column prop="printedAt" label="打印时间" width="170" />
        <el-table-column prop="watermark" label="水印" show-overflow-tooltip />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.title { font-weight: 600; }
.desc { color: #606266; font-size: 13px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.preview { max-height: 260px; overflow: auto; background: #f7f8fa; padding: 8px; font-size: 12px; }
@media (max-width: 1200px) { .grid { grid-template-columns: 1fr; } }
</style>
