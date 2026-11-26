<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { addFavorite, fetchFavorites, removeFavorite, type UserFavorite } from '@/api/user-preference'

const router = useRouter()
const rows = ref<UserFavorite[]>([])
const loading = ref(false)
const targetTypeFilter = ref('')
const dialogVisible = ref(false)
const submitting = ref(false)
const form = ref({ targetType: 'PAGE', targetKey: '', title: '', route: '', remark: '' })

const TARGET_TYPES = [
  { label: '页面', value: 'PAGE' },
  { label: '记录', value: 'RECORD' },
  { label: '菜单', value: 'MENU' },
  { label: '文档', value: 'DOC' }
]

let requestSeq = 0

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  try {
    const list = await fetchFavorites(targetTypeFilter.value ? { targetType: targetTypeFilter.value } : undefined)
    if (seq !== requestSeq) return
    rows.value = list
  } catch (cause) {
    if (seq === requestSeq) ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function openAdd(): void {
  form.value = { targetType: 'PAGE', targetKey: '', title: '', route: '', remark: '' }
  dialogVisible.value = true
}

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    await addFavorite({
      targetType: form.value.targetType,
      targetKey: form.value.targetKey.trim(),
      title: form.value.title.trim(),
      route: form.value.route.trim() || undefined,
      remark: form.value.remark.trim() || undefined
    })
    dialogVisible.value = false
    ElMessage.success('收藏成功')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '收藏失败')
  } finally {
    submitting.value = false
  }
}

async function handleRemove(row: unknown): Promise<void> {
  const item = row as UserFavorite
  await ElMessageBox.confirm(`确认取消收藏「${item.title}」？`, '提示', { type: 'warning' })
  await removeFavorite(item.id)
  ElMessage.success('已取消收藏')
  await load()
}

function handleOpen(row: unknown): void {
  const item = row as UserFavorite
  if (item.route) {
    void router.push(item.route)
    return
  }
  if (item.bizType && item.bizId) {
    ElMessage.info(`业务记录：${item.bizType} #${item.bizId}`)
    return
  }
  ElMessage.info('该收藏未配置跳转地址')
}

onMounted(load)
onUnmounted(() => {
  requestSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>我的收藏</h2>
      <p>集中管理收藏的页面与业务记录，支持快速跳转与统一清理。</p>
    </header>

    <div class="favorite-toolbar">
      <el-select v-model="targetTypeFilter" placeholder="全部类型" clearable style="width: 140px" @change="load">
        <el-option v-for="item in TARGET_TYPES" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-button type="primary" @click="openAdd">新增收藏</el-button>
      <el-button @click="load">刷新</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="title" label="名称" minWidth="200" />
      <el-table-column prop="targetType" label="类型" width="110">
        <template #default="{ row }">{{ TARGET_TYPES.find((item) => item.value === row.targetType)?.label ?? row.targetType }}</template>
      </el-table-column>
      <el-table-column prop="targetKey" label="标识" minWidth="180" />
      <el-table-column prop="route" label="跳转地址" minWidth="200">
        <template #default="{ row }">{{ row.route ?? '-' }}</template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" minWidth="140" />
      <el-table-column prop="createdAt" label="收藏时间" width="180" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleOpen(row)">打开</el-button>
          <el-button link type="danger" @click="handleRemove(row)">取消收藏</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="新增收藏" width="480px">
      <el-form label-width="90px">
        <el-form-item label="类型">
          <el-select v-model="form.targetType" style="width: 100%">
            <el-option v-for="item in TARGET_TYPES" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="标识" required>
          <el-input v-model="form.targetKey" placeholder="唯一标识，如 supplier:12" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="跳转地址">
          <el-input v-model="form.route" placeholder="如 /purchase/supplier" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.favorite-toolbar {
  display: flex;
  align-items: center;
  gap: var(--erp-space-2);
  margin-bottom: var(--erp-space-3);
}
</style>
