<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  downloadAuditExportCsv,
  fetchExportWatermarkPolicy,
  saveExportWatermarkEnabled,
  saveExportWatermarkText,
  type ExportWatermarkPolicy
} from '@/api/export-watermark'

const policy = ref<ExportWatermarkPolicy>({ enabled: true, extraText: null })
const loading = ref(false)
const saving = ref(false)
const downloading = ref(false)
const text = ref('')

async function load(): Promise<void> {
  loading.value = true
  try {
    policy.value = await fetchExportWatermarkPolicy()
    text.value = policy.value.extraText ?? ''
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载水印策略失败')
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  if (saving.value) return
  saving.value = true
  try {
    await saveExportWatermarkEnabled(policy.value.enabled)
    policy.value = await saveExportWatermarkText(text.value.trim())
    text.value = policy.value.extraText ?? ''
    ElMessage.success('水印策略已保存')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function downloadAudit(): Promise<void> {
  if (downloading.value) return
  downloading.value = true
  try {
    const blob = await downloadAuditExportCsv()
    saveBlob(blob, `audit-export-${Date.now()}.csv`)
    ElMessage.success('导出文件已生成（含水印）')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '导出失败')
  } finally {
    downloading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>导出水印</h2>
      <p>所有导出文件均追加水印块：租户编号、导出人、导出时间与水印编码，用于溯源与防泄密；敏感字段在导出时自动脱敏。</p>
    </header>

    <article class="panel" v-loading="loading">
      <el-form label-width="130px" class="policy-form">
        <el-form-item label="水印开关">
          <el-switch v-model="policy.enabled" active-text="启用" inactive-text="停用" />
          <span class="hint">停用后导出文件不再追加水印块，导出行为仍记录审计日志。</span>
        </el-form-item>
        <el-form-item label="水印说明文案">
          <el-input v-model="text" maxlength="200" placeholder="例如：内部资料，请勿外传" />
          <span class="hint">该文案会作为附加行写入导出文件的水印块。</span>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" v-perm="'system:config:update'" :loading="saving" @click="save">保存策略</el-button>
          <el-button :loading="downloading" v-perm="'system:audit:view'" @click="downloadAudit">导出审计日志（含水印）</el-button>
        </el-form-item>
      </el-form>

      <el-descriptions :column="2" border size="small" class="policy-desc">
        <el-descriptions-item label="水印编码">tenant-{租户ID}-user-{用户ID}-{时间戳}</el-descriptions-item>
        <el-descriptions-item label="导出人">当前登录用户（真实姓名优先）</el-descriptions-item>
        <el-descriptions-item label="导出时间">服务端生成时间（ISO8601）</el-descriptions-item>
        <el-descriptions-item label="生效范围">导入导出、审计导出、打印水印</el-descriptions-item>
      </el-descriptions>
    </article>
  </section>
</template>

<style scoped>
.panel {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.policy-form {
  max-width: 720px;
}

.policy-desc {
  margin-top: 12px;
}

.hint {
  margin-left: 12px;
  color: #909399;
  font-size: 12px;
}
</style>
