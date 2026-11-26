<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import BaseDrawer from '@/components/BaseDrawer.vue'
import {
  createNotifyTemplate,
  fetchNotifyTemplates,
  sendNotifyByTemplate,
  testNotifyChannel,
  updateNotifyTemplate,
  type NotifyTemplate
} from '@/api/notify'
import type { FieldDef } from '@/types/contract'

const channelOptions = [
  { label: '站内信', value: 'INMAIL' },
  { label: '邮件', value: 'EMAIL' },
  { label: '短信', value: 'SMS' },
  { label: '企业微信', value: 'WECOM' },
  { label: '钉钉', value: 'DINGTALK' }
]

const fields: FieldDef[] = [
  { key: 'name', label: '模板名称', type: 'input', required: true, maxlength: 120 },
  { key: 'title', label: '标题模板', type: 'input', required: true, maxlength: 200 },
  { key: 'content', label: '正文模板', type: 'textarea', required: true },
  { key: 'channels', label: '发送渠道', type: 'select', required: true, options: channelOptions }
]

const rows = ref<NotifyTemplate[]>([])
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const drawerVisible = ref(false)
const submitting = ref(false)
const editingId = ref<number | null>(null)
const form = ref<Record<string, unknown>>({ name: '', title: '', content: '', channels: 'INMAIL' })

const sendVisible = ref(false)
const sending = ref(false)
const sendTarget = ref<NotifyTemplate | null>(null)
const sendForm = ref<{ receiverId: number; variablesText: string; level: string }>({
  receiverId: 0,
  variablesText: '{}',
  level: 'LOW'
})

const testVisible = ref(false)
const testing = ref(false)
const testForm = ref<{ channel: string; target: string }>({ channel: 'EMAIL', target: '' })

function fail(cause: unknown): void {
  ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    rows.value = await fetchNotifyTemplates()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function filteredRows(): NotifyTemplate[] {
  const term = keyword.value.trim().toLowerCase()
  if (!term) return rows.value
  return rows.value.filter(
    (item) => item.code.toLowerCase().includes(term) || item.name.toLowerCase().includes(term)
  )
}

function openAdd(): void {
  editingId.value = null
  form.value = { name: '', title: '', content: '', channels: 'INMAIL' }
  drawerVisible.value = true
}

function openEdit(row: NotifyTemplate): void {
  editingId.value = row.id
  form.value = {
    name: row.name,
    title: row.title,
    content: row.content,
    channels: row.channels || 'INMAIL'
  }
  drawerVisible.value = true
}

async function save(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  const payload = {
    name: String(form.value.name).trim(),
    title: String(form.value.title).trim(),
    content: String(form.value.content ?? '').trim(),
    channels: String(form.value.channels ?? 'INMAIL')
  }
  try {
    if (editingId.value) {
      await updateNotifyTemplate(editingId.value, payload)
    } else {
      await createNotifyTemplate({ code: `TPL${Date.now()}`, ...payload })
    }
    drawerVisible.value = false
    ElMessage.success('模板已保存')
    await load()
  } catch (cause) {
    fail(cause)
  } finally {
    submitting.value = false
  }
}

async function toggleStatus(row: NotifyTemplate): Promise<void> {
  try {
    await updateNotifyTemplate(row.id, { status: row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })
    ElMessage.success(row.status === 'ACTIVE' ? '模板已停用' : '模板已启用')
    await load()
  } catch (cause) {
    fail(cause)
  }
}

function openSend(row: NotifyTemplate): void {
  sendTarget.value = row
  sendForm.value = { receiverId: 0, variablesText: '{}', level: 'LOW' }
  sendVisible.value = true
}

async function submitSend(): Promise<void> {
  if (!sendTarget.value || sending.value) return
  let variables: Record<string, unknown>
  try {
    variables = JSON.parse(sendForm.value.variablesText || '{}') as Record<string, unknown>
  } catch {
    ElMessage.warning('变量必须为合法 JSON')
    return
  }
  sending.value = true
  try {
    const results = await sendNotifyByTemplate(sendTarget.value.code, {
      receiverId: sendForm.value.receiverId,
      variables,
      level: sendForm.value.level
    })
    sendVisible.value = false
    ElMessage.success(`已生成 ${results.length} 条发送记录`)
  } catch (cause) {
    fail(cause)
  } finally {
    sending.value = false
  }
}

function openTest(): void {
  testForm.value = { channel: 'EMAIL', target: '' }
  testVisible.value = true
}

async function submitTest(): Promise<void> {
  if (testing.value) return
  testing.value = true
  try {
    const result = await testNotifyChannel({ channel: testForm.value.channel, target: testForm.value.target })
    if (result.ok) {
      ElMessage.success('渠道连通正常')
      testVisible.value = false
    } else {
      ElMessage.warning(result.reason ?? '渠道不可用')
    }
  } catch (cause) {
    fail(cause)
  } finally {
    testing.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>通知模板</h2>
      <p>维护站内信、邮件、短信等渠道的通知模板；标题与正文使用双花括号变量占位，保存时校验变量名，发送时校验变量完整性。</p>
    </header>

    <article class="notify-panel">
      <div class="filter-bar">
        <el-input v-model="keyword" placeholder="搜索模板编码/名称" clearable style="width: 240px" />
        <el-button type="primary" @click="load">刷新</el-button>
        <el-button v-perm="'system:notify:create'" type="primary" plain @click="openAdd">新增模板</el-button>
        <el-button v-perm="'system:notify:update'" @click="openTest">渠道连通性测试</el-button>
      </div>

      <div v-if="error" class="error-banner">{{ error }}</div>

      <el-table v-loading="loading" :data="filteredRows()" row-key="id">
        <el-table-column prop="code" label="模板编码" width="160" />
        <el-table-column prop="name" label="模板名称" width="180" />
        <el-table-column prop="title" label="标题模板" min-width="200" show-overflow-tooltip />
        <el-table-column prop="channels" label="渠道" width="180" />
        <el-table-column label="模板变量" min-width="180">
          <template #default="{ row }">
            <el-tag v-for="name in row.variables" :key="name" size="small" style="margin-right: 4px">
              {{ name }}
            </el-tag>
            <span v-if="!row.variables.length" class="hint">无变量</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">
              {{ row.status === 'ACTIVE' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230" align="center">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'system:notify:update'" @click="openEdit(row)">编辑</el-button>
            <el-button link v-perm="'system:notify:create'" @click="openSend(row)">发送</el-button>
            <el-button link v-perm="'system:notify:update'" @click="toggleStatus(row)">
              {{ row.status === 'ACTIVE' ? '停用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>

    <BaseDrawer
      v-model="drawerVisible"
      :title="editingId ? '编辑通知模板' : '新增通知模板'"
      :fields="fields"
      :form="form"
      :loading="submitting"
      :is-edit="!!editingId"
      submit-perm="system:notify:update"
      @update:form="form = $event"
      @submit="save"
    />

    <el-dialog v-model="sendVisible" title="按模板发送通知" width="560px">
      <el-form label-width="90px">
        <el-form-item label="模板">
          <el-input :model-value="sendTarget?.code" disabled />
        </el-form-item>
        <el-form-item label="必填变量">
          <el-input :model-value="(sendTarget?.variables ?? []).join('、')" disabled />
        </el-form-item>
        <el-form-item label="接收人ID">
          <el-input-number v-model="sendForm.receiverId" :min="1" />
        </el-form-item>
        <el-form-item label="级别">
          <el-select v-model="sendForm.level">
            <el-option label="低" value="LOW" />
            <el-option label="中" value="MEDIUM" />
            <el-option label="高" value="HIGH" />
            <el-option label="紧急" value="CRITICAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="变量JSON">
          <el-input v-model="sendForm.variablesText" type="textarea" :rows="4" placeholder='{"orderNo":"SO-1"}' />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sendVisible = false">取消</el-button>
        <el-button type="primary" :loading="sending" @click="submitSend">发送</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="testVisible" title="渠道连通性测试" width="480px">
      <el-form label-width="90px">
        <el-form-item label="渠道">
          <el-select v-model="testForm.channel">
            <el-option v-for="option in channelOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="测试地址">
          <el-input v-model="testForm.target" placeholder="邮箱/手机号，可留空" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="testVisible = false">取消</el-button>
        <el-button type="primary" :loading="testing" @click="submitTest">开始测试</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.notify-panel {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
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

.hint {
  color: #909399;
  font-size: 12px;
}
</style>
