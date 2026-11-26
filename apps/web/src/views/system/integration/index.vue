<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchIntegrationConfigs,
  fetchIntegrationMessages,
  removeIntegrationConfig,
  sendTodo,
  updateIntegrationConfig,
  upsertIntegrationConfig,
  type IntegrationConfig,
  type IntegrationMessage
} from '@/api/integration'
import type { PageQuery } from '@/types/contract'

const configs = ref<IntegrationConfig[]>([])
const messages = ref<IntegrationMessage[]>([])
const loading = ref(false)
const configVisible = ref(false)
const sendVisible = ref(false)
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const form = reactive({ id: 0, channel: 'WECHAT' as 'WECHAT' | 'DINGTALK', name: '', webhookUrl: '', secret: '', status: 'ACTIVE' })
const sendForm = reactive({ channel: 'WECHAT' as 'WECHAT' | 'DINGTALK', title: '', content: '', assignee: '', taskId: 0 })

async function load(): Promise<void> {
  loading.value = true
  try {
    const [configResult, messageResult] = await Promise.all([
      fetchIntegrationConfigs(query),
      fetchIntegrationMessages(query)
    ])
    configs.value = configResult.list
    messages.value = messageResult.list
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载集成配置失败')
  } finally {
    loading.value = false
  }
}

function openConfig(id = 0): void {
  if (!id) {
    Object.assign(form, { id: 0, channel: 'WECHAT', name: '', webhookUrl: '', secret: '', status: 'ACTIVE' })
  } else {
    const row = configs.value.find((item) => item.id === id)
    if (!row) return
    Object.assign(form, {
      id: row.id, channel: row.channel as 'WECHAT' | 'DINGTALK', name: row.name,
      webhookUrl: row.webhookUrl, secret: '', status: row.status
    })
  }
  configVisible.value = true
}

async function saveConfig(): Promise<void> {
  const data = {
    channel: form.channel,
    name: form.name,
    webhookUrl: form.webhookUrl,
    secret: form.secret || undefined,
    status: form.status
  }
  try {
    if (form.id) await updateIntegrationConfig(form.id, data)
    else await upsertIntegrationConfig(data)
    configVisible.value = false
    ElMessage.success('集成配置已保存')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function removeConfig(id: number): Promise<void> {
  try {
    await removeIntegrationConfig(id)
    ElMessage.success('配置已删除')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '删除失败')
  }
}

function openSendByValue(value: unknown): void {
  openSend(value === 'DINGTALK' ? 'DINGTALK' : 'WECHAT')
}

function openSend(channel: 'WECHAT' | 'DINGTALK'): void {
  Object.assign(sendForm, { channel, title: '待办提醒', content: '您有一条新的 ERP 待办任务。', assignee: '', taskId: 0 })
  sendVisible.value = true
}

async function send(): Promise<void> {
  try {
    const result = await sendTodo(sendForm.channel, {
      title: sendForm.title,
      content: sendForm.content,
      assignee: sendForm.assignee || undefined,
      taskId: sendForm.taskId || undefined
    })
    sendVisible.value = false
    ElMessage.success(`推送${result.status === 'SENT' ? '成功' : '失败'}：${result.responseText ?? ''}`)
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '推送失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>消息集成</h2>
      <p>配置企业微信或钉钉机器人 Webhook，将待办任务以 Markdown 消息推送，密钥加密保存。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-button type="primary" v-perm="'system:integration:create'" @click="openConfig()">新增配置</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table :data="configs" row-key="id" v-loading="loading">
        <el-table-column prop="channel" label="渠道" width="120" />
        <el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column prop="webhookUrl" label="Webhook" min-width="260" />
        <el-table-column prop="secretMask" label="签名密钥" width="150" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'system:integration:update'" @click="openConfig(Number(row.id))">编辑</el-button>
            <el-button link type="success" v-perm="'system:integration:create'" @click="openSendByValue(row.channel)">推送</el-button>
            <el-button link type="danger" v-perm="'system:integration:delete'" @click="removeConfig(Number(row.id))">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>

    <article class="panel message-panel">
      <h3>推送记录</h3>
      <el-table :data="messages" row-key="id" size="small">
        <el-table-column prop="channel" label="渠道" width="110" />
        <el-table-column prop="title" label="标题" min-width="160" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column prop="responseText" label="响应" min-width="180" />
        <el-table-column prop="createdAt" label="时间" min-width="170" />
      </el-table>
    </article>

    <el-dialog v-model="configVisible" :title="form.id ? '编辑集成配置' : '新增集成配置'" width="560px">
      <el-form label-width="100px">
        <el-form-item label="渠道">
          <el-select v-model="form.channel" :disabled="form.id > 0">
            <el-option label="企业微信" value="WECHAT" />
            <el-option label="钉钉" value="DINGTALK" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="Webhook"><el-input v-model="form.webhookUrl" /></el-form-item>
        <el-form-item label="签名密钥"><el-input v-model="form.secret" placeholder="钉钉安全密钥或企微签名密钥" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="configVisible = false">取消</el-button><el-button type="primary" @click="saveConfig">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="sendVisible" title="推送待办" width="520px">
      <el-form label-width="90px">
        <el-form-item label="标题"><el-input v-model="sendForm.title" /></el-form-item>
        <el-form-item label="处理人"><el-input v-model="sendForm.assignee" /></el-form-item>
        <el-form-item label="任务 ID"><el-input-number v-model="sendForm.taskId" :min="0" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="sendForm.content" type="textarea" :rows="4" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="sendVisible = false">取消</el-button><el-button type="primary" @click="send">发送</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; margin-bottom: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.message-panel h3 { margin-top: 0; }
</style>
