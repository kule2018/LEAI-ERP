<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createChat, fetchChats, type ChatMessage } from '@/api/collaboration'

const channel = ref('general')
const messages = ref<ChatMessage[]>([])
const content = ref('')

async function load(): Promise<void> {
  try { messages.value = await fetchChats(channel.value) }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
}
async function send(): Promise<void> {
  if (!content.value.trim()) return
  try {
    await createChat({ channel: channel.value, content: content.value })
    content.value = ''
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '发送失败') }
}
onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>企业聊天</h2><p>按频道查看和发送消息。</p></header>
    <article class="chat-panel">
      <el-input v-model="channel" placeholder="频道" class="channel-input" @keyup.enter="load" />
      <div class="messages">
        <div v-for="item in messages" :key="item.id" class="message">
          <span class="sender">用户 {{ item.senderId }}</span>
          <span>{{ item.content }}</span>
        </div>
        <el-empty v-if="messages.length === 0" description="暂无消息" />
      </div>
      <div class="composer">
        <el-input v-model="content" placeholder="输入消息" @keyup.enter="send" />
        <el-button type="primary" v-perm="'oa:chat:create'" @click="send">发送</el-button>
      </div>
    </article>
  </section>
</template>

<style scoped>
.chat-panel { padding: 16px; background: #fff; border-radius: 8px; }
.channel-input { width: 240px; margin-bottom: 16px; }
.messages { min-height: 360px; max-height: 480px; overflow-y: auto; padding: 12px; background: #f7f9fc; border-radius: 6px; }
.message { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid #e5e6eb; }
.sender { color: #1677ff; font-weight: 600; }
.composer { display: flex; gap: 8px; margin-top: 16px; }
</style>
