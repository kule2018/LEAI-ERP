<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createConversation, createCsQuality, fetchConversations, fetchQuickReplies,
  replyConversation, type ShopConversation
} from '@/api/shop'
import type { PageQuery } from '@/types/contract'

const conversations = ref<ShopConversation[]>([])
const total = ref(0)
const loading = ref(false)
const createVisible = ref(false)
const replyVisible = ref(false)
const currentId = ref(0)
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const form = reactive({ storeId: 0, platformBuyerId: '', message: '' })
const replyForm = reactive({ message: '' })
const qcVisible = ref(false)
const qcForm = reactive({ responseMinutes: 5, resolved: true, politeness: 5, note: '' })
const quickReplies = ref<Array<{ code: string; content: string; matched: boolean }>>([])

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchConversations(query)
    conversations.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载会话失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, { storeId: 0, platformBuyerId: '', message: '' })
  createVisible.value = true
}

async function handleCreate(): Promise<void> {
  try {
    await createConversation({ ...form })
    createVisible.value = false
    ElMessage.success('会话已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '创建失败')
  }
}

function openReply(id: number): void {
  currentId.value = id
  replyForm.message = ''
  replyVisible.value = true
}

async function handleReply(): Promise<void> {
  try {
    await replyConversation(currentId.value, replyForm.message)
    replyVisible.value = false
    ElMessage.success('回复已发送')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '回复失败')
  }
}

function openQc(id: number): void {
  currentId.value = id
  Object.assign(qcForm, { responseMinutes: 5, resolved: true, politeness: 5, note: '' })
  qcVisible.value = true
}

async function handleQuickReplies(): Promise<void> {
  try {
    quickReplies.value = await fetchQuickReplies(replyForm.message || '退款')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '推荐失败')
  }
}

async function handleQc(): Promise<void> {
  try {
    const review = await createCsQuality(currentId.value, { ...qcForm })
    qcVisible.value = false
    ElMessage.success(`质检完成：${review.result}（${review.score} 分）`)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '质检失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>商城客服</h2>
      <p>会话按店铺聚合，回复内容进入同步日志；可结合 AI 智能客服生成建议话术。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索买家 ID" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'shop:cs:create'" @click="openCreate">新建会话</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="conversations" row-key="id">
        <el-table-column prop="storeId" label="店铺 ID" width="100" />
        <el-table-column prop="platformBuyerId" label="平台买家" min-width="150" />
        <el-table-column prop="lastMessage" label="最近消息" min-width="240" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="170" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'shop:cs:reply'" @click="openReply(Number(row.id))">回复</el-button>
            <el-button link type="warning" v-perm="'shop:cs:qc'" @click="openQc(Number(row.id))">质检</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="createVisible" title="新建客服会话" width="480px">
      <el-form label-width="110px">
        <el-form-item label="店铺 ID"><el-input-number v-model="form.storeId" :min="1" /></el-form-item>
        <el-form-item label="平台买家 ID"><el-input v-model="form.platformBuyerId" /></el-form-item>
        <el-form-item label="首条消息"><el-input v-model="form.message" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="replyVisible" title="回复会话" width="480px">
      <el-form label-width="80px">
        <el-form-item label="回复内容"><el-input v-model="replyForm.message" type="textarea" :rows="4" /></el-form-item>
        <el-button v-perm="'shop:cs:reply'" @click="handleQuickReplies">推荐话术</el-button>
        <div v-for="item in quickReplies" :key="item.code" class="quick-reply" @click="replyForm.message = item.content">
          <el-tag :type="item.matched ? 'success' : 'info'">{{ item.code }}</el-tag>
          <span>{{ item.content }}</span>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="replyVisible = false">取消</el-button>
        <el-button type="primary" @click="handleReply">发送</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="qcVisible" title="客服质检" width="480px">
      <el-form label-width="110px">
        <el-form-item label="响应分钟"><el-input-number v-model="qcForm.responseMinutes" :min="0" /></el-form-item>
        <el-form-item label="是否解决"><el-switch v-model="qcForm.resolved" /></el-form-item>
        <el-form-item label="态度评分"><el-input-number v-model="qcForm.politeness" :min="1" :max="5" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="qcForm.note" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="qcVisible = false">取消</el-button>
        <el-button type="primary" @click="handleQc">提交质检</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.quick-reply { display: flex; gap: 8px; align-items: center; margin-top: 8px; padding: 8px; cursor: pointer; background: #f5f5f5; border-radius: 6px; font-size: 12px; }
</style>
