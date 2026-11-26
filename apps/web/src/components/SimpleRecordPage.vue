<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

interface Column {
  prop: string
  label: string
  width?: string
}

interface Field {
  key: string
  label: string
  type?: 'text' | 'number' | 'textarea' | 'select' | 'switch'
  options?: Array<{ label: string; value: string | number }>
}

interface RowAction {
  label: string
  call: (row: any) => Promise<unknown>
}

const props = defineProps<{
  title: string
  description?: string
  columns: Column[]
  fields?: Field[]
  fetcher: (params: Record<string, unknown>) => Promise<{ list: any[]; total: number }>
  creator?: (data: Record<string, unknown>) => Promise<unknown>
  actions?: RowAction[]
  defaultParams?: Record<string, unknown>
}>()

const rows = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const dialogVisible = ref(false)
const form = reactive<Record<string, any>>({})

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await props.fetcher({ page: 1, pageSize: 50, ...(props.defaultParams ?? {}) })
    rows.value = result.list
    total.value = result.total
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  for (const field of props.fields ?? []) {
    form[field.key] = field.type === 'number' ? 0 : field.type === 'switch' ? false : ''
  }
  dialogVisible.value = true
}

async function save(): Promise<void> {
  if (!props.creator) return
  const data: Record<string, unknown> = {}
  for (const field of props.fields ?? []) data[field.key] = form[field.key]
  await props.creator(data)
  dialogVisible.value = false
  ElMessage.success('已保存')
  await load()
}

async function runAction(action: RowAction, row: any): Promise<void> {
  await action.call(row)
  ElMessage.success('操作完成')
  await load()
}

onMounted(load)
</script>

<template>
  <div class="simple-page">
    <el-card shadow="never">
      <template #header>
        <div class="header">
          <span class="title">{{ title }}</span>
          <el-button v-if="creator" type="primary" size="small" @click="openCreate">新建</el-button>
        </div>
      </template>
      <p v-if="description" class="description">{{ description }}</p>
      <el-table :data="rows" v-loading="loading" size="small" border>
        <el-table-column v-for="column in columns" :key="column.prop" :prop="column.prop" :label="column.label" :width="column.width" show-overflow-tooltip />
        <el-table-column v-if="actions?.length" label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button v-for="action in actions" :key="action.label" link type="primary" size="small" @click="runAction(action, row)">{{ action.label }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="footer">共 {{ total }} 条</div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="`新建${title}`" width="520px">
      <el-form label-width="100px" size="small">
        <el-form-item v-for="field in fields" :key="field.key" :label="field.label">
          <el-input v-if="!field.type || field.type === 'text'" v-model="form[field.key]" />
          <el-input-number v-else-if="field.type === 'number'" v-model="form[field.key]" :min="0" />
          <el-input v-else-if="field.type === 'textarea'" v-model="form[field.key]" type="textarea" :rows="3" />
          <el-select v-else-if="field.type === 'select'" v-model="form[field.key]">
            <el-option v-for="option in field.options" :key="String(option.value)" :label="option.label" :value="option.value" />
          </el-select>
          <el-switch v-else-if="field.type === 'switch'" v-model="form[field.key]" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" size="small" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.header { display: flex; justify-content: space-between; align-items: center; }
.title { font-weight: 600; }
.description { margin: 0 0 12px; color: #606266; font-size: 13px; }
.footer { margin-top: 10px; color: #909399; font-size: 12px; text-align: right; }
</style>
