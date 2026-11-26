<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { uploadFile, type FileRecord } from '@/api/file'

const props = withDefaults(defineProps<{
  modelValue?: string
  fileUrl?: string
  mimeType?: string
  accept?: string
  placeholder?: string
  disabled?: boolean
}>(), {
  modelValue: '',
  fileUrl: '',
  mimeType: '',
  accept: '',
  placeholder: '选择文件',
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:fileUrl': [value: string]
  'update:mimeType': [value: string]
  'uploaded': [record: FileRecord, text: string]
}>()

async function readText(file: File): Promise<string> {
  const textLike = file.type.startsWith('text/') || /\.(txt|csv|json|md|log|xml)$/i.test(file.name)
  if (!textLike || file.size > 2 * 1024 * 1024) return ''
  try {
    return await file.text()
  } catch {
    return ''
  }
}

async function handleUpload(options: { file: File }): Promise<void> {
  const file = options.file
  try {
    const record = await uploadFile(file)
    emit('update:modelValue', record.fileName)
    emit('update:fileUrl', record.url ?? '')
    emit('update:mimeType', record.mimeType ?? file.type)
    emit('uploaded', record, await readText(file))
    ElMessage.success(`已上传：${record.fileName}`)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '上传失败')
  }
}
</script>

<template>
  <el-upload
    :http-request="handleUpload"
    :show-file-list="false"
    :accept="props.accept"
    :disabled="props.disabled"
  >
    <el-button :disabled="props.disabled" plain type="primary">
      {{ props.modelValue ? '重新选择' : props.placeholder }}
    </el-button>
    <span v-if="props.modelValue" class="ai-file-name">{{ props.modelValue }}</span>
  </el-upload>
</template>

<style scoped>
.ai-file-name {
  margin-left: 8px;
  color: #606266;
  font-size: 13px;
}
</style>
