<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createApiKey,
  createWebhook,
  fetchApiKeys,
  fetchDeliveries,
  fetchWebhooks,
  publishEvent,
  removeApiKey,
  removeWebhook,
  retryDelivery,
  rotateApiKey,
  setApiKeyStatus,
  updateWebhook,
  type ApiKey,
  type CreatedApiKey,
  type Webhook,
  type WebhookDelivery
} from '@/api/openapi'
import type { PageQuery } from '@/types/contract'

const active = ref('keys')
const keys = ref<ApiKey[]>([])
const webhooks = ref<Webhook[]>([])
const deliveries = ref<WebhookDelivery[]>([])
const loading = ref(false)
const keyDialog = ref(false)
const webhookDialog = ref(false)
const secretDialog = ref(false)
const currentSecret = ref('')
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const keyForm = reactive({ name: '', scopes: 'event:publish', expiresAt: '' })
const webhookForm = reactive({ id: 0, name: '', url: '', eventTypes: 'sale.order.created', secret: '', retryLimit: 3, status: 'ACTIVE' })
const eventForm = reactive({ eventType: 'sale.order.created', payload: '{"orderNo":"SO-001"}' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const [keyResult, hookResult, deliveryResult] = await Promise.all([
      fetchApiKeys(query),
      fetchWebhooks(query),
      fetchDeliveries(query)
    ])
    keys.value = keyResult.list
    webhooks.value = hookResult.list
    deliveries.value = deliveryResult.list
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载开放平台数据失败')
  } finally {
    loading.value = false
  }
}

function openKeyDialog(): void {
  Object.assign(keyForm, { name: '', scopes: 'event:publish', expiresAt: '' })
  keyDialog.value = true
}

function showSecret(result: CreatedApiKey): void {
  currentSecret.value = `${result.keyId}\n${result.secret}`
  secretDialog.value = true
}

async function saveKey(): Promise<void> {
  try {
    const result = await createApiKey({
      name: keyForm.name,
      scopes: keyForm.scopes.split(',').map((item) => item.trim()).filter(Boolean),
      expiresAt: keyForm.expiresAt || undefined
    })
    keyDialog.value = false
    showSecret(result)
    ElMessage.success('API Key 已创建，请立即复制密钥')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '创建失败')
  }
}

async function rotate(id: number): Promise<void> {
  await ElMessageBox.confirm('轮换后旧密钥立即失效，确认继续？', '提示', { type: 'warning' })
  try {
    showSecret(await rotateApiKey(id))
    ElMessage.success('密钥已轮换')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '轮换失败')
  }
}

async function toggleKey(id: number, status: string): Promise<void> {
  try {
    await setApiKeyStatus(id, status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '状态更新失败')
  }
}

async function deleteKey(id: number): Promise<void> {
  await ElMessageBox.confirm('确认删除该 API Key？', '提示', { type: 'warning' })
  try {
    await removeApiKey(id)
    ElMessage.success('API Key 已删除')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '删除失败')
  }
}

function openWebhookDialog(id = 0): void {
  if (!id) {
    Object.assign(webhookForm, { id: 0, name: '', url: '', eventTypes: 'sale.order.created', secret: '', retryLimit: 3, status: 'ACTIVE' })
  } else {
    const row = webhooks.value.find((item) => item.id === id)
    if (!row) return
    Object.assign(webhookForm, {
      id: row.id, name: row.name, url: row.url, eventTypes: row.eventTypes.join(','),
      secret: '', retryLimit: row.retryLimit, status: row.status
    })
  }
  webhookDialog.value = true
}

async function saveWebhook(): Promise<void> {
  const payload = {
    name: webhookForm.name,
    url: webhookForm.url,
    eventTypes: webhookForm.eventTypes.split(',').map((item) => item.trim()).filter(Boolean),
    secret: webhookForm.secret || undefined,
    retryLimit: webhookForm.retryLimit,
    status: webhookForm.status
  }
  try {
    if (webhookForm.id) await updateWebhook(webhookForm.id, payload)
    else await createWebhook(payload)
    webhookDialog.value = false
    ElMessage.success('Webhook 已保存')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function deleteWebhook(id: number): Promise<void> {
  await ElMessageBox.confirm('确认删除该 Webhook？', '提示', { type: 'warning' })
  try {
    await removeWebhook(id)
    ElMessage.success('Webhook 已删除')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '删除失败')
  }
}

async function retry(id: number): Promise<void> {
  try {
    await retryDelivery(id)
    ElMessage.success('已重新投递')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '重试失败')
  }
}

async function publish(): Promise<void> {
  try {
    const payload: unknown = JSON.parse(eventForm.payload)
    const result = await publishEvent({ eventType: eventForm.eventType, payload: payload as Record<string, unknown> })
    ElMessage.success(`事件已投递给 ${result.deliveries.length} 个订阅方`)
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '发布失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>开放平台</h2>
      <p>API Key 管理外部调用凭证，Webhook 订阅业务事件；密钥轮换与投递重试均留审计。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-button type="primary" v-perm="'system:openapi:create'" @click="openKeyDialog">新增 API Key</el-button>
        <el-button v-perm="'system:openapi:create'" @click="openWebhookDialog()">新增 Webhook</el-button>
        <el-button @click="load">刷新</el-button>
      </div>

      <el-tabs v-model="active">
        <el-tab-pane label="API Key" name="keys">
          <el-table :data="keys" row-key="id" v-loading="loading">
            <el-table-column prop="keyId" label="Key ID" min-width="180" />
            <el-table-column prop="name" label="名称" min-width="150" />
            <el-table-column prop="scopes" label="权限范围" min-width="180" />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column prop="lastUsedAt" label="最后使用" min-width="170" />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button link type="warning" v-perm="'system:openapi:update'" @click="rotate(Number(row.id))">轮换</el-button>
                <el-button link type="primary" v-perm="'system:openapi:update'" @click="toggleKey(Number(row.id), String(row.status))">启停</el-button>
                <el-button link type="danger" v-perm="'system:openapi:delete'" @click="deleteKey(Number(row.id))">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="Webhook" name="webhooks">
          <el-table :data="webhooks" row-key="id" v-loading="loading">
            <el-table-column prop="name" label="名称" width="150" />
            <el-table-column prop="url" label="地址" min-width="240" />
            <el-table-column prop="eventTypes" label="订阅事件" min-width="200" />
            <el-table-column prop="secretMask" label="签名密钥" width="150" />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" v-perm="'system:openapi:update'" @click="openWebhookDialog(Number(row.id))">编辑</el-button>
                <el-button link type="danger" v-perm="'system:openapi:delete'" @click="deleteWebhook(Number(row.id))">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="投递记录" name="deliveries">
          <el-table :data="deliveries" row-key="id" v-loading="loading">
            <el-table-column prop="eventType" label="事件" width="180" />
            <el-table-column prop="webhookId" label="Webhook ID" width="120" />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column prop="attemptCount" label="尝试次数" width="100" />
            <el-table-column prop="responseText" label="响应" min-width="220" />
            <el-table-column prop="createdAt" label="创建时间" min-width="170" />
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" v-perm="'system:openapi:update'" :disabled="row.status === 'DELIVERED'" @click="retry(Number(row.id))">重试</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="事件发布" name="publish">
          <el-form label-width="110px" class="publish-form">
            <el-form-item label="事件类型"><el-input v-model="eventForm.eventType" /></el-form-item>
            <el-form-item label="载荷 JSON"><el-input v-model="eventForm.payload" type="textarea" :rows="6" /></el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'system:openapi:create'" @click="publish">发布事件</el-button>
        </el-tab-pane>
      </el-tabs>
    </article>

    <el-dialog v-model="keyDialog" title="新增 API Key" width="520px">
      <el-form label-width="100px">
        <el-form-item label="名称"><el-input v-model="keyForm.name" /></el-form-item>
        <el-form-item label="权限范围"><el-input v-model="keyForm.scopes" placeholder="多个范围用逗号分隔" /></el-form-item>
        <el-form-item label="过期时间"><el-date-picker v-model="keyForm.expiresAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="YYYY-MM-DDTHH:mm:ss"  /></el-form-item>
      </el-form>
      <template #footer><el-button @click="keyDialog = false">取消</el-button><el-button type="primary" @click="saveKey">创建</el-button></template>
    </el-dialog>

    <el-dialog v-model="webhookDialog" :title="webhookForm.id ? '编辑 Webhook' : '新增 Webhook'" width="560px">
      <el-form label-width="100px">
        <el-form-item label="名称"><el-input v-model="webhookForm.name" /></el-form-item>
        <el-form-item label="地址"><el-input v-model="webhookForm.url" /></el-form-item>
        <el-form-item label="订阅事件"><el-input v-model="webhookForm.eventTypes" placeholder="多个事件用逗号分隔" /></el-form-item>
        <el-form-item label="签名密钥"><el-input v-model="webhookForm.secret" placeholder="留空则自动生成" /></el-form-item>
        <el-form-item label="重试上限"><el-input-number v-model="webhookForm.retryLimit" :min="1" :max="10" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="webhookForm.status">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="webhookDialog = false">取消</el-button><el-button type="primary" @click="saveWebhook">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="secretDialog" title="请立即复制凭证" width="520px">
      <el-alert type="warning" :closable="false" title="密钥仅显示一次，关闭后无法再次查看。" />
      <pre class="secret">{{ currentSecret }}</pre>
      <template #footer><el-button type="primary" @click="secretDialog = false">已复制</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.publish-form { max-width: 640px; }
.secret { padding: 16px; background: #f7f8fa; border-radius: 6px; white-space: pre-wrap; word-break: break-all; }
</style>
