<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createAiModel, fetchAiModels, updateAiModel, type AiModelConfig } from '@/api/ai'

const models = ref<AiModelConfig[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingId = ref(0)
const form = reactive({
  code: '',
  name: '',
  provider: 'LOCAL',
  capability: 'ALL',
  grayPercent: 0,
  model: 'local-rule-engine',
  endpoint: '',
  apiKey: '',
  temperature: 0.2,
  maxTokens: 2048,
  rateLimit: 60,
  isDefault: 'NO' as 'YES' | 'NO'
})

async function load(): Promise<void> {
  loading.value = true
  try {
    models.value = await fetchAiModels()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载模型配置失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  editingId.value = 0
  Object.assign(form, {
    code: '', name: '', provider: 'LOCAL', capability: 'ALL', grayPercent: 0,
    model: 'local-rule-engine', endpoint: '', apiKey: '',
    temperature: 0.2, maxTokens: 2048, rateLimit: 60, isDefault: 'NO'
  })
  dialogVisible.value = true
}

function openEdit(row: AiModelConfig): void {
  editingId.value = row.id
  Object.assign(form, {
    code: row.code,
    name: row.name,
    provider: row.provider,
    capability: row.capability ?? 'ALL',
    grayPercent: row.grayPercent ?? 0,
    model: row.model,
    endpoint: row.endpoint ?? '',
    apiKey: '',
    temperature: Number(row.temperature),
    maxTokens: row.maxTokens,
    rateLimit: row.rateLimit,
    isDefault: row.isDefault === 1 ? 'YES' : 'NO'
  })
  dialogVisible.value = true
}

async function save(): Promise<void> {
  const payload = {
    code: form.code,
    name: form.name,
    provider: form.provider,
    capability: form.capability,
    grayPercent: form.grayPercent,
    model: form.model,
    endpoint: form.endpoint || undefined,
    apiKey: form.apiKey || undefined,
    temperature: form.temperature,
    maxTokens: form.maxTokens,
    rateLimit: form.rateLimit,
    isDefault: form.isDefault
  }
  try {
    if (editingId.value) await updateAiModel(editingId.value, payload)
    else await createAiModel(payload)
    dialogVisible.value = false
    ElMessage.success('模型配置已保存')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

function openEditById(id: number): void {
  const row = models.value.find((item) => item.id === id)
  if (row) openEdit(row)
}

async function toggleById(id: number): Promise<void> {
  const row = models.value.find((item) => item.id === id)
  if (!row) return
  try {
    await updateAiModel(id, { status: row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '状态更新失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>模型配置</h2>
      <p>模型密钥仅保存脱敏值；无外部密钥时统一使用本地规则引擎兜底。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-button type="primary" v-perm="'ai:model:create'" @click="openCreate">新增模型</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table :data="models" row-key="id" v-loading="loading">
        <el-table-column prop="code" label="编码" width="130" />
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="provider" label="供应商" width="120" />
        <el-table-column prop="capability" label="能力" width="130" />
        <el-table-column prop="grayPercent" label="灰度%" width="90" />
        <el-table-column prop="model" label="模型" min-width="150" />
        <el-table-column prop="apiKeyMask" label="密钥" width="150" />
        <el-table-column prop="rateLimit" label="限流/分" width="110" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditById(Number(row.id))">编辑</el-button>
            <el-button link type="warning" @click="toggleById(Number(row.id))">切换状态</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑模型' : '新增模型'" width="560px">
      <el-form label-width="100px">
        <el-form-item label="编码"><el-input v-model="form.code" :disabled="editingId > 0" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="供应商"><el-input v-model="form.provider" /></el-form-item>
        <el-form-item label="能力范围"><el-input v-model="form.capability" placeholder="ALL 或 ai.forecast" /></el-form-item>
        <el-form-item label="灰度比例"><el-input-number v-model="form.grayPercent" :min="0" :max="100" /></el-form-item>
        <el-form-item label="模型"><el-input v-model="form.model" /></el-form-item>
        <el-form-item label="接口地址"><el-input v-model="form.endpoint" /></el-form-item>
        <el-form-item label="密钥"><el-input v-model="form.apiKey" type="password" show-password /></el-form-item>
        <el-form-item label="温度"><el-input-number v-model="form.temperature" :min="0" :max="1" :precision="2" /></el-form-item>
        <el-form-item label="最大 Token"><el-input-number v-model="form.maxTokens" :min="1" /></el-form-item>
        <el-form-item label="限流/分"><el-input-number v-model="form.rateLimit" :min="1" /></el-form-item>
        <el-form-item label="默认模型">
          <el-select v-model="form.isDefault">
            <el-option label="是" value="YES" />
            <el-option label="否" value="NO" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
