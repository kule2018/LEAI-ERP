<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createDataScope,
  DATA_SCOPE_OPTIONS,
  fetchDataScopes,
  previewDataScope,
  type DataScopeRule
} from '@/api/data-scope'
import type { PageQuery } from '@/types/contract'

const rows = ref<DataScopeRule[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const dialogVisible = ref(false)
const previewBizType = ref('SALES_ORDER')
const previewResult = ref<{ level: string; orgField: string; matched?: string } | null>(null)
const form = reactive({
  scopeCode: '',
  scopeName: '',
  bizType: 'ALL',
  orgField: 'dept_id',
  scopeLevel: 'SELF',
  priority: 0
})

let requestSeq = 0

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchDataScopes(query.value)
    if (seq !== requestSeq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function openCreate(): void {
  form.scopeCode = ''
  form.scopeName = ''
  form.bizType = 'ALL'
  form.orgField = 'dept_id'
  form.scopeLevel = 'SELF'
  form.priority = 0
  dialogVisible.value = true
}

async function handleCreate(): Promise<void> {
  try {
    await createDataScope({ ...form })
    dialogVisible.value = false
    ElMessage.success('规则已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '创建失败')
  }
}

async function handlePreview(): Promise<void> {
  try {
    previewResult.value = await previewDataScope(previewBizType.value)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '预览失败')
  }
}

function scopeLabel(row: unknown): string {
  const value = (row as DataScopeRule).scopeLevel
  return DATA_SCOPE_OPTIONS.find((option) => option.value === value)?.label ?? value
}

onMounted(load)
onUnmounted(() => {
  requestSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>数据权限</h2>
      <p>规则先由角色数据范围收敛，再与接口声明范围取更严格值；超级管理员不受限制。</p>
    </header>

    <article class="scope-panel">
      <div class="panel-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索规则" clearable @keyup.enter="load" />
        <el-input v-model="previewBizType" placeholder="预览业务类型" style="width: 180px" />
        <el-button v-perm="'system:data-scope:view'" @click="handlePreview">规则预览</el-button>
        <el-button type="primary" v-perm="'system:data-scope:create'" @click="openCreate">新增规则</el-button>
        <el-button @click="load">刷新</el-button>
      </div>

      <div v-if="previewResult" class="preview-result">
        命中规则：{{ previewResult.matched ?? '无自定义规则' }}；最终范围：{{ previewResult.level }}；组织字段：{{ previewResult.orgField }}
      </div>
      <div v-if="error" class="error-banner">{{ error }}</div>

      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="scopeCode" label="规则编码" width="160" />
        <el-table-column prop="scopeName" label="规则名称" width="180" />
        <el-table-column prop="bizType" label="业务类型" width="140" />
        <el-table-column prop="orgField" label="组织字段" width="140" />
        <el-table-column label="范围" width="140">
          <template #default="{ row }">{{ scopeLabel(row) }}</template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="100" />
        <el-table-column prop="status" label="状态" width="100" />
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="total"
          :current-page="query.page"
          :page-size="query.pageSize"
          @current-change="(value: number) => { query.page = value; void load() }"
        />
      </div>
    </article>

    <el-dialog v-model="dialogVisible" title="新增数据权限规则" width="560px">
      <el-form label-width="100px">
        <el-form-item label="规则编码"><el-input v-model="form.scopeCode" /></el-form-item>
        <el-form-item label="规则名称"><el-input v-model="form.scopeName" /></el-form-item>
        <el-form-item label="业务类型"><el-input v-model="form.bizType" /></el-form-item>
        <el-form-item label="组织字段"><el-input v-model="form.orgField" /></el-form-item>
        <el-form-item label="数据范围">
          <el-select v-model="form.scopeLevel">
            <el-option v-for="option in DATA_SCOPE_OPTIONS" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级"><el-input-number v-model="form.priority" :min="0" :max="9999" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.scope-panel {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.panel-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.preview-result {
  margin-bottom: 16px;
  padding: 10px 16px;
  color: #0958d9;
  background: #e6f4ff;
  border-radius: 6px;
}

.error-banner {
  margin-bottom: 16px;
  padding: 12px 16px;
  color: #f5222d;
  background: #fff1f0;
  border-radius: 8px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
