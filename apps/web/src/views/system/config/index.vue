<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchSystemConfigs, removeSystemConfig, saveSystemConfig, type SystemConfig } from '@/api/system-config'

const configs = ref<SystemConfig[]>([])
const loading = ref(false)
const error = ref('')
const visible = ref(false)
const editing = ref<SystemConfig | null>(null)
const form = ref({ configKey: '', configValue: '', valueType: 'STRING', category: '', remark: '' })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    configs.value = await fetchSystemConfigs()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  editing.value = null
  form.value = { configKey: '', configValue: '', valueType: 'STRING', category: 'custom', remark: '' }
  visible.value = true
}

function openEdit(row: unknown): void {
  const item = row as SystemConfig
  editing.value = item
  form.value = {
    configKey: item.configKey,
    configValue: item.configValue ?? '',
    valueType: item.valueType,
    category: item.category ?? '',
    remark: item.remark ?? ''
  }
  visible.value = true
}

async function save(): Promise<void> {
  if (!form.value.configKey.trim()) {
    ElMessage.warning('请填写参数键')
    return
  }
  try {
    await saveSystemConfig({
      configKey: form.value.configKey.trim(),
      configValue: form.value.configValue,
      valueType: form.value.valueType,
      category: form.value.category || undefined,
      remark: form.value.remark || undefined
    })
    ElMessage.success('参数已保存')
    visible.value = false
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function remove(row: unknown): Promise<void> {
  const item = row as SystemConfig
  if (item.isSystem === 1) {
    ElMessage.warning('系统内置参数不可删除')
    return
  }
  try {
    await removeSystemConfig(item.configKey)
    ElMessage.success('已删除')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '删除失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>系统参数</h2>
      <p>租户级运行参数，统一收敛硬编码阈值与开关配置，支持按分类维护。</p>
    </header>

    <article class="config-panel">
      <div class="filter-bar">
        <el-button type="primary" v-perm="'system:config:update'" @click="openCreate">新增参数</el-button>
        <el-button @click="load">刷新</el-button>
      </div>

      <div v-if="error" class="error-banner">{{ error }}</div>

      <el-table v-loading="loading" :data="configs" row-key="id">
        <el-table-column prop="configKey" label="参数键" min-width="200" />
        <el-table-column prop="configValue" label="参数值" min-width="200" show-overflow-tooltip />
        <el-table-column prop="valueType" label="类型" width="110" />
        <el-table-column prop="category" label="分类" width="130" />
        <el-table-column label="内置" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.isSystem === 1" type="warning">内置</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="说明" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'system:config:update'" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" v-perm="'system:config:update'" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>

    <el-dialog v-model="visible" :title="editing ? '编辑参数' : '新增参数'" width="520px">
      <el-form label-width="90px">
        <el-form-item label="参数键">
          <el-input v-model="form.configKey" :disabled="!!editing" placeholder="如 security.password.policy" />
        </el-form-item>
        <el-form-item label="参数值">
          <el-input v-model="form.configValue" type="textarea" :rows="3" placeholder="JSON 类型填写 JSON 文本" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.valueType" style="width: 100%">
            <el-option label="字符串" value="STRING" />
            <el-option label="数字" value="NUMBER" />
            <el-option label="布尔" value="BOOLEAN" />
            <el-option label="JSON" value="JSON" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类"><el-input v-model="form.category" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="form.remark" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.config-panel {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.filter-bar {
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
</style>
