<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchNotices, fetchTodo, type FlowTask, type Notice } from '@/api/collaboration'
import {
  batchActTasks,
  confirmNotice,
  createMeeting,
  createSensitiveWord,
  fetchSensitiveWords,
  fetchUnreadChatCount,
  removeSensitiveWord
} from '@/api/ops-enhancement'

const words = ref<Array<{ id: number; word: string; level: string; enabled: string }>>([])
const notices = ref<Notice[]>([])
const todos = ref<FlowTask[]>([])
const selectedTodos = ref<number[]>([])
const unread = ref(0)
const wordForm = reactive({ word: '', level: 'MEDIUM' })
const meetingForm = reactive({ title: '', meetingAt: '', minutes: '' })
const batchForm = reactive({ action: 'APPROVE' as 'APPROVE' | 'REJECT', comment: '' })

function fail(cause: unknown): void {
  ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
}

async function loadWords(): Promise<void> {
  try {
    words.value = await fetchSensitiveWords()
  } catch (cause) {
    fail(cause)
  }
}

async function loadNotices(): Promise<void> {
  try {
    const result = await fetchNotices({ page: 1, pageSize: 50 })
    notices.value = result.list
  } catch (cause) {
    fail(cause)
  }
}

async function loadTodos(): Promise<void> {
  try {
    const result = await fetchTodo({ page: 1, pageSize: 50 })
    todos.value = result.list
  } catch (cause) {
    fail(cause)
  }
}

async function loadUnread(): Promise<void> {
  try {
    const result = await fetchUnreadChatCount()
    unread.value = result.unread
  } catch (cause) {
    fail(cause)
  }
}

async function handleAddWord(): Promise<void> {
  try {
    await createSensitiveWord({ word: wordForm.word, level: wordForm.level })
    ElMessage.success('敏感词已添加')
    wordForm.word = ''
    await loadWords()
  } catch (cause) {
    fail(cause)
  }
}

async function handleRemoveWord(row: { id: number }): Promise<void> {
  try {
    await removeSensitiveWord(row.id)
    ElMessage.success('敏感词已删除')
    await loadWords()
  } catch (cause) {
    fail(cause)
  }
}

async function handleConfirmNotice(row: Notice): Promise<void> {
  try {
    await confirmNotice(row.id)
    ElMessage.success('公告已确认')
  } catch (cause) {
    fail(cause)
  }
}

async function handleMeeting(): Promise<void> {
  try {
    const result = await createMeeting({
      title: meetingForm.title,
      meetingAt: meetingForm.meetingAt || undefined,
      minutes: meetingForm.minutes || undefined
    })
    ElMessage.success(`会议已记录，生成待办 ${result.tasks.length} 条`)
    meetingForm.title = ''
    meetingForm.minutes = ''
  } catch (cause) {
    fail(cause)
  }
}

async function handleBatchAct(): Promise<void> {
  if (!selectedTodos.value.length) {
    ElMessage.warning('请先选择待办')
    return
  }
  try {
    const result = await batchActTasks(selectedTodos.value, batchForm.action, batchForm.comment)
    ElMessage.success(`成功 ${result.succeeded.length} 条，失败 ${result.failed.length} 条`)
    selectedTodos.value = []
    await loadTodos()
  } catch (cause) {
    fail(cause)
  }
}

onMounted(() => {
  void loadWords()
  void loadNotices()
  void loadTodos()
  void loadUnread()
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>协同运营增强</h2>
      <p>敏感词过滤、公告确认回执、会议纪要转待办、待办批量审批与未读消息统计。</p>
    </header>

    <el-tabs>
      <el-tab-pane label="敏感词库" name="word">
        <el-form :inline="true">
          <el-form-item label="敏感词">
            <el-input v-model="wordForm.word" style="width: 180px" />
          </el-form-item>
          <el-form-item label="级别">
            <el-select v-model="wordForm.level" style="width: 140px">
              <el-option label="低" value="LOW" />
              <el-option label="中" value="MEDIUM" />
              <el-option label="高（直接拦截）" value="HIGH" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" v-perm="'oa:notice:create'" @click="handleAddWord">添加</el-button>
          </el-form-item>
        </el-form>
        <el-table :data="words" size="small">
          <el-table-column prop="word" label="敏感词" min-width="160" />
          <el-table-column prop="level" label="级别" width="120" />
          <el-table-column prop="enabled" label="状态" width="100" />
          <el-table-column label="操作" width="110">
            <template #default="{ row }">
              <el-button link type="danger" v-perm="'oa:notice:create'" @click="handleRemoveWord(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="公告确认" name="notice">
        <el-table :data="notices" size="small">
          <el-table-column prop="title" label="标题" min-width="220" />
          <el-table-column prop="channel" label="渠道" width="110" />
          <el-table-column prop="publishedFlag" label="发布状态" width="110" />
          <el-table-column label="操作" width="110">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleConfirmNotice(row)">确认</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="会议纪要转待办" name="meeting">
        <el-form :inline="true">
          <el-form-item label="会议主题">
            <el-input v-model="meetingForm.title" style="width: 200px" />
          </el-form-item>
          <el-form-item label="会议时间">
            <el-date-picker v-model="meetingForm.meetingAt" type="datetime" value-format="YYYY-MM-DD HH:mm" style="width: 170px" placeholder="YYYY-MM-DD HH:mm"  />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" v-perm="'oa:project:create'" @click="handleMeeting">保存并生成待办</el-button>
          </el-form-item>
        </el-form>
        <el-input v-model="meetingForm.minutes" type="textarea" :rows="6" placeholder="每行一条待办，格式：任务名称 | 负责人ID | 截止日期" />
      </el-tab-pane>

      <el-tab-pane name="todo">
        <template #label>
          <span>批量审批待办</span>
          <el-badge v-if="unread" :value="unread" class="unread-badge" />
        </template>
        <el-form :inline="true">
          <el-form-item label="动作">
            <el-select v-model="batchForm.action" style="width: 130px">
              <el-option label="通过" value="APPROVE" />
              <el-option label="驳回" value="REJECT" />
            </el-select>
          </el-form-item>
          <el-form-item label="意见">
            <el-input v-model="batchForm.comment" style="width: 220px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" v-perm="'flow:todo:approve'" @click="handleBatchAct">批量处理</el-button>
          </el-form-item>
        </el-form>
        <el-table :data="todos" row-key="id" @selection-change="(rows: FlowTask[]) => (selectedTodos = rows.map((item) => item.id))">
          <el-table-column type="selection" width="50" />
          <el-table-column prop="id" label="待办ID" width="90" />
          <el-table-column prop="instanceId" label="流程实例" width="110" />
          <el-table-column prop="nodeId" label="节点" width="90" />
          <el-table-column prop="assigneeId" label="处理人" width="100" />
          <el-table-column prop="dueAt" label="截止时间" width="170" />
          <el-table-column prop="status" label="状态" width="100" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.unread-badge {
  margin-left: 8px;
}
</style>
