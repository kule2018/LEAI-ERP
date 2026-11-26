<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { confirmCopilot, runCopilot, streamCopilot } from '@/api/ai'

interface ChatMessage {
  id: number
  role: 'USER' | 'ASSISTANT'
  content: string
  auditId?: number
  confirmed?: boolean
}

const messages = ref<ChatMessage[]>([
  {
    id: 1,
    role: 'ASSISTANT',
    content: '我是 LEAI ERP Copilot。当前使用本地规则引擎，建议仅作参考；写入业务数据前请人工确认。'
  }
])
const prompt = ref('')
const loading = ref(false)
const streaming = ref(false)
let sequence = 1

async function send(): Promise<void> {
  const text = prompt.value.trim()
  if (!text || loading.value) return

  messages.value.push({ id: ++sequence, role: 'USER', content: text })
  prompt.value = ''
  loading.value = true
  try {
    const result = await runCopilot(text)
    messages.value.push({
      id: ++sequence,
      role: 'ASSISTANT',
      content: result.suggestion,
      auditId: result.auditId,
      confirmed: false
    })
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '请求失败')
  } finally {
    loading.value = false
  }
}

/** 流式提问：SSE 逐段渲染，结束后可人工确认写入 */
async function sendStream(): Promise<void> {
  const text = prompt.value.trim()
  if (!text || loading.value) return

  messages.value.push({ id: ++sequence, role: 'USER', content: text })
  prompt.value = ''
  loading.value = true
  streaming.value = true
  const reply = reactive<ChatMessage>({ id: ++sequence, role: 'ASSISTANT', content: '' })
  messages.value.push(reply)
  try {
    await streamCopilot(
      text,
      (delta) => { reply.content += delta },
      (auditId) => { reply.auditId = auditId }
    )
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '流式请求失败')
  } finally {
    streaming.value = false
    loading.value = false
  }
}

async function confirm(message: ChatMessage, accepted: 'YES' | 'NO'): Promise<void> {
  if (!message.auditId) return
  try {
    const result = await confirmCopilot(message.auditId, accepted)
    message.confirmed = true
    if (accepted === 'YES' && result.appliedBizId) {
      ElMessage.success(`已采纳并写入业务单据：${result.appliedBizType} #${result.appliedBizId}`)
    } else {
      ElMessage.success(accepted === 'YES' ? '已采纳建议' : '已拒绝建议')
    }
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '确认失败')
  }
}
</script>

<template>
  <section class="page-container copilot-page">
    <header class="page-header">
      <h2>AI Copilot</h2>
      <p>所有建议均写入 AI 审计日志；采纳或拒绝由人工确认。可写回的建议需通过权限二次校验，采纳后生成正式业务单据。</p>
    </header>

    <article class="chat-panel">
      <div class="message-list">
        <div v-for="message in messages" :key="message.id" class="message-row" :class="message.role.toLowerCase()">
          <div class="message-bubble">{{ message.content }}</div>
          <div v-if="message.auditId" class="message-actions">
            <el-button link type="primary" :disabled="message.confirmed" @click="confirm(message, 'YES')">采纳</el-button>
            <el-button link type="danger" :disabled="message.confirmed" @click="confirm(message, 'NO')">拒绝</el-button>
            <span v-if="message.confirmed" class="confirmed">已处理</span>
          </div>
        </div>
      </div>

      <div class="composer">
        <el-input
          v-model="prompt"
          type="textarea"
          :rows="3"
          placeholder="例如：如何校验销售单库存和信用额度？"
          @keyup.ctrl.enter="send"
        />
        <el-button type="primary" :loading="loading" @click="send">发送</el-button>
        <el-button :loading="streaming" :disabled="loading" @click="sendStream">流式提问</el-button>
      </div>
    </article>
  </section>
</template>

<style scoped>
.copilot-page {
  height: 100%;
}

.chat-panel {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 180px);
  min-height: 480px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.message-list {
  flex: 1;
  padding-right: 8px;
  overflow-y: auto;
}

.message-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 16px;
}

.message-row.user {
  align-items: flex-end;
}

.message-bubble {
  max-width: 76%;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 8px;
  line-height: 22px;
  white-space: pre-wrap;
}

.message-row.user .message-bubble {
  color: #fff;
  background: var(--erp-color-primary);
}

.message-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.confirmed {
  color: #646a73;
  font-size: 12px;
}

.composer {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  padding-top: 16px;
  border-top: 1px solid #e5e6eb;
}
</style>
