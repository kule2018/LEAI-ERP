<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchRevisionDiff,
  fetchRevisionSnapshot,
  fetchRevisionSnapshots,
  type RevisionDiffEntry,
  type RevisionSnapshot
} from '@/api/revision'
import type { PageQuery } from '@/types/contract'

const rows = ref<RevisionSnapshot[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const entityFilter = ref('')
const bizIdFilter = ref<number | undefined>(undefined)

const detailVisible = ref(false)
const current = ref<RevisionSnapshot | null>(null)
const diffVisible = ref(false)
const diffRows = ref<RevisionDiffEntry[]>([])
const diffSummary = ref({ added: 0, removed: 0, changed: 0, total: 0 })
const compareFrom = ref<number | undefined>(undefined)
const compareTo = ref<number | undefined>(undefined)

let requestSeq = 0

const changeTypeLabel: Record<string, string> = {
  ADDED: '新增',
  REMOVED: '删除',
  CHANGED: '变更'
}

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchRevisionSnapshots({
      page: query.value.page,
      pageSize: query.value.pageSize,
      keyword: query.value.keyword,
      entityCode: entityFilter.value || undefined,
      bizId: bizIdFilter.value
    })
    if (seq !== requestSeq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function openDetail(row: unknown): Promise<void> {
  const snapshot = row as RevisionSnapshot
  try {
    current.value = await fetchRevisionSnapshot(snapshot.id)
    detailVisible.value = true
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载详情失败')
  }
}

async function openDiff(): Promise<void> {
  if (!compareFrom.value || !compareTo.value) {
    ElMessage.warning('请选择两个版本进行比较')
    return
  }
  try {
    const result = await fetchRevisionDiff(compareFrom.value, compareTo.value)
    diffRows.value = result.diff
    diffSummary.value = result.summary
    diffVisible.value = true
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '版本比对失败')
  }
}

function handlePage(value: number): void {
  query.value.page = value
  void load()
}

function handlePageSize(value: number): void {
  query.value.pageSize = value
  void load()
}

onMounted(load)
onUnmounted(() => {
  requestSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>版本快照</h2>
      <p>各业务单据在提交、审批等关键节点留存的版本快照，支持版本列表、快照查看与版本差异比对。</p>
    </header>

    <div class="revision-toolbar">
      <el-input v-model="entityFilter" placeholder="业务对象编码" clearable @keyup.enter="load" />
      <el-input-number v-model="bizIdFilter" :controls="false" placeholder="单据 ID" @keyup.enter="load" />
      <el-input v-model="query.keyword" placeholder="搜索操作/备注" clearable @keyup.enter="load" />
      <el-button @click="load">查询</el-button>
      <div class="revision-compare">
        <el-select v-model="compareFrom" placeholder="源版本 ID" clearable style="width: 140px">
          <el-option v-for="item in rows" :key="item.id" :label="`#${item.id} v${item.versionNo}`" :value="item.id" />
        </el-select>
        <span>→</span>
        <el-select v-model="compareTo" placeholder="目标版本 ID" clearable style="width: 140px">
          <el-option v-for="item in rows" :key="item.id" :label="`#${item.id} v${item.versionNo}`" :value="item.id" />
        </el-select>
        <el-button type="primary" plain @click="openDiff">版本比对</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="id" label="ID" width="90" />
      <el-table-column prop="entityCode" label="业务对象" width="150" />
      <el-table-column prop="bizId" label="单据 ID" width="100" />
      <el-table-column prop="versionNo" label="版本" width="80" align="center" />
      <el-table-column prop="action" label="动作" width="120" />
      <el-table-column prop="source" label="来源" width="110" />
      <el-table-column prop="operatorName" label="操作人" width="120" />
      <el-table-column prop="remark" label="备注" minWidth="160" />
      <el-table-column prop="createdAt" label="创建时间" width="180" />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">查看</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="error" class="page-error">{{ error }}</div>

    <div class="revision-pager">
      <el-pagination
        :current-page="query.page"
        :page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @current-change="handlePage"
        @size-change="handlePageSize"
      />
    </div>

    <el-drawer v-model="detailVisible" title="版本快照详情" size="640px">
      <template v-if="current">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="业务对象">{{ current.entityCode }}</el-descriptions-item>
          <el-descriptions-item label="单据 ID">{{ current.bizId }}</el-descriptions-item>
          <el-descriptions-item label="版本号">v{{ current.versionNo }}</el-descriptions-item>
          <el-descriptions-item label="动作">{{ current.action }}</el-descriptions-item>
          <el-descriptions-item label="操作人">{{ current.operatorName ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ current.createdAt }}</el-descriptions-item>
        </el-descriptions>
        <h4>快照内容</h4>
        <pre class="revision-json">{{ JSON.stringify(current.snapshot, null, 2) }}</pre>
        <template v-if="current.diff && current.diff.length">
          <h4>与上一版本差异</h4>
          <el-table :data="current.diff" border size="small">
            <el-table-column prop="field" label="字段" width="200" />
            <el-table-column label="类型" width="90">
              <template #default="{ row }">{{ changeTypeLabel[row.type] ?? row.type }}</template>
            </el-table-column>
            <el-table-column prop="before" label="变更前" min-width="160" />
            <el-table-column prop="after" label="变更后" min-width="160" />
          </el-table>
        </template>
      </template>
    </el-drawer>

    <el-dialog v-model="diffVisible" title="版本差异比对" width="760px">
      <el-descriptions :column="4" border>
        <el-descriptions-item label="新增">{{ diffSummary.added }}</el-descriptions-item>
        <el-descriptions-item label="删除">{{ diffSummary.removed }}</el-descriptions-item>
        <el-descriptions-item label="变更">{{ diffSummary.changed }}</el-descriptions-item>
        <el-descriptions-item label="合计">{{ diffSummary.total }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="diffRows" border size="small" style="margin-top: 12px">
        <el-table-column prop="field" label="字段" width="200" />
        <el-table-column label="类型" width="90">
          <template #default="{ row }">{{ changeTypeLabel[row.type] ?? row.type }}</template>
        </el-table-column>
        <el-table-column prop="before" label="变更前" min-width="200" />
        <el-table-column prop="after" label="变更后" min-width="200" />
      </el-table>
    </el-dialog>
  </section>
</template>

<style scoped>
.revision-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--erp-space-2);
  margin-bottom: var(--erp-space-3);
}

.revision-compare {
  display: flex;
  align-items: center;
  gap: var(--erp-space-2);
  margin-left: auto;
}

.revision-pager {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--erp-space-3);
}

.revision-json {
  max-height: 320px;
  overflow: auto;
  padding: 12px;
  border-radius: 4px;
  background: #f7f8fa;
  font-size: 12px;
}
</style>
