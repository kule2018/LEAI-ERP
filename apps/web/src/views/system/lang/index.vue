<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteLangEntry,
  diffLangPackage,
  fetchLangEntries,
  fetchLangPackages,
  upsertLangEntries,
  type LangDiffResult,
  type LangEntry,
  type SystemLangItem
} from '@/api/system-lang'
import type { GridColumn } from '@/types/contract'

const rows = ref<SystemLangItem[]>([])
const loading = ref(false)
const error = ref('')
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const query = reactive({ langCode: '', keyword: '' })

const dialogVisible = ref(false)
const editingId = ref(0)
const form = reactive({
  langCode: 'zh_CN',
  localeName: '简体中文',
  resourceKey: '',
  resourceValue: '',
  fallbackLang: ''
})
const saving = ref(false)

const packageVisible = ref(false)
const packages = ref<Array<{ langCode: string; localeName: string; values: Record<string, string> }>>([])
const packageLang = ref('zh_CN')
const packageText = ref('')
const diffResult = ref<LangDiffResult | null>(null)

const columns: GridColumn[] = [
  { prop: 'langCode', label: '语言编码', width: 120 },
  { prop: 'localeName', label: '语言名称', width: 140 },
  { prop: 'resourceKey', label: '资源键', width: 260 },
  { prop: 'resourceValue', label: '资源值', width: 260 },
  { prop: 'fallbackLang', label: '回退语言', width: 120 }
]

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await fetchLangEntries({
      page: page.value,
      pageSize: pageSize.value,
      langCode: query.langCode || undefined,
      keyword: query.keyword || undefined
    })
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function handleSearch(): void {
  page.value = 1
  void load()
}

function handleReset(): void {
  query.langCode = ''
  query.keyword = ''
  page.value = 1
  void load()
}

function openCreate(): void {
  editingId.value = 0
  form.langCode = 'zh_CN'
  form.localeName = '简体中文'
  form.resourceKey = ''
  form.resourceValue = ''
  form.fallbackLang = ''
  dialogVisible.value = true
}

function openEdit(row: unknown): void {
  const item = row as SystemLangItem
  editingId.value = item.id
  form.langCode = item.langCode
  form.localeName = item.localeName
  form.resourceKey = item.resourceKey
  form.resourceValue = item.resourceValue
  form.fallbackLang = item.fallbackLang ?? ''
  dialogVisible.value = true
}

async function handleSave(): Promise<void> {
  if (!form.resourceKey.trim()) {
    ElMessage.warning('请填写资源键')
    return
  }
  saving.value = true
  try {
    const entry: LangEntry = {
      langCode: form.langCode,
      resourceKey: form.resourceKey.trim(),
      resourceValue: form.resourceValue,
      fallbackLang: form.fallbackLang || undefined,
      localeName: form.localeName
    }
    const result = await upsertLangEntries([entry])
    ElMessage.success(`保存成功：新增 ${result.created}，更新 ${result.updated}`)
    dialogVisible.value = false
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleRemove(row: unknown): Promise<void> {
  const item = row as SystemLangItem
  await ElMessageBox.confirm(`确认删除 ${item.resourceKey} ？`, '提示', { type: 'warning' })
  await deleteLangEntry(item.id)
  ElMessage.success('删除成功')
  await load()
}

async function openPackages(): Promise<void> {
  packages.value = await fetchLangPackages()
  packageLang.value = packages.value[0]?.langCode ?? 'zh_CN'
  packageText.value = ''
  diffResult.value = null
  packageVisible.value = true
}

function parsePackageText(): Record<string, string> {
  const values: Record<string, string> = {}
  for (const line of packageText.value.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    values[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim()
  }
  return values
}

async function handleDiff(): Promise<void> {
  const values = parsePackageText()
  if (Object.keys(values).length === 0) {
    ElMessage.warning('请输入 key=value 格式的语言包内容')
    return
  }
  diffResult.value = await diffLangPackage(packageLang.value, values)
}

async function handleApplyPackage(): Promise<void> {
  const values = parsePackageText()
  if (Object.keys(values).length === 0) {
    ElMessage.warning('请输入 key=value 格式的语言包内容')
    return
  }
  const target = packages.value.find((item) => item.langCode === packageLang.value)
  const entries: LangEntry[] = Object.entries(values).map(([key, value]) => ({
    langCode: packageLang.value,
    resourceKey: key,
    resourceValue: value,
    localeName: target?.localeName ?? packageLang.value
  }))
  const result = await upsertLangEntries(entries)
  ElMessage.success(`导入成功：新增 ${result.created}，更新 ${result.updated}`)
  await load()
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="lang-page">
    <section class="lang-filter">
      <el-form :inline="true" @submit.prevent="handleSearch">
        <el-form-item label="语言编码">
          <el-select v-model="query.langCode" clearable placeholder="全部" style="width: 160px">
            <el-option label="zh_CN" value="zh_CN" />
            <el-option label="en_US" value="en_US" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="query.keyword" placeholder="资源键 / 资源值" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="lang-table">
      <div class="lang-toolbar">
        <el-button type="primary" v-perm="'system:lang:update'" @click="openCreate">新增条目</el-button>
        <el-button v-perm="'system:lang:view'" @click="openPackages">语言包维护</el-button>
        <el-button @click="load">刷新</el-button>
      </div>

      <div v-if="error" class="lang-error">
        <p>加载失败：{{ error }}</p>
        <el-button type="primary" @click="load">重试</el-button>
      </div>

      <el-table v-else v-loading="loading" :data="rows" border stripe>
        <el-table-column
          v-for="column in columns"
          :key="column.prop"
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          show-overflow-tooltip
        />
        <el-table-column label="操作" fixed="right" width="140" align="center">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'system:lang:update'" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" v-perm="'system:lang:update'" @click="handleRemove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="lang-pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :current-page="page"
          :page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          @current-change="(value: number) => { page = value; load() }"
          @size-change="(value: number) => { pageSize = value; page = 1; load() }"
        />
      </div>
    </section>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑语言条目' : '新增语言条目'" width="520px">
      <el-form label-width="96px">
        <el-form-item label="语言编码">
          <el-select v-model="form.langCode" :disabled="editingId > 0" style="width: 100%">
            <el-option label="zh_CN" value="zh_CN" />
            <el-option label="en_US" value="en_US" />
          </el-select>
        </el-form-item>
        <el-form-item label="语言名称">
          <el-input v-model="form.localeName" placeholder="如 简体中文" />
        </el-form-item>
        <el-form-item label="资源键">
          <el-input v-model="form.resourceKey" placeholder="如 common.action.save" />
        </el-form-item>
        <el-form-item label="资源值">
          <el-input v-model="form.resourceValue" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="回退语言">
          <el-select v-model="form.fallbackLang" clearable placeholder="无" style="width: 100%">
            <el-option label="zh_CN" value="zh_CN" />
            <el-option label="en_US" value="en_US" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="packageVisible" title="语言包维护" width="720px">
      <el-form label-width="96px">
        <el-form-item label="目标语言">
          <el-select v-model="packageLang" style="width: 200px">
            <el-option
              v-for="item in packages"
              :key="item.langCode"
              :label="`${item.localeName} (${item.langCode})`"
              :value="item.langCode"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="包内容">
          <el-input
            v-model="packageText"
            type="textarea"
            :rows="10"
            placeholder="每行一条 key=value"
          />
        </el-form-item>
      </el-form>

      <div v-if="diffResult" class="lang-diff">
        <p>新增 {{ diffResult.added.length }} 条，变更 {{ diffResult.updated.length }} 条，移除 {{ diffResult.removed.length }} 条</p>
        <ul>
          <li v-for="key in diffResult.added" :key="`a-${key}`" class="diff-added">+ {{ key }}</li>
          <li v-for="key in diffResult.changedKeys" :key="`c-${key}`" class="diff-changed">~ {{ key }}</li>
          <li v-for="key in diffResult.removed" :key="`r-${key}`" class="diff-removed">- {{ key }}</li>
        </ul>
      </div>

      <template #footer>
        <el-button @click="handleDiff">比较差异</el-button>
        <el-button type="primary" v-perm="'system:lang:update'" @click="handleApplyPackage">保存语言包</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.lang-page {
  display: flex;
  flex-direction: column;
  gap: var(--erp-space-4);
}

.lang-filter,
.lang-table {
  padding: var(--erp-space-4);
  background: #fff;
  border-radius: var(--erp-radius-base);
}

.lang-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--erp-space-2);
  margin-bottom: var(--erp-space-4);
}

.lang-error p {
  margin: 0 0 var(--erp-space-3);
  color: #f5222d;
}

.lang-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--erp-space-4);
}

.lang-diff {
  margin-top: var(--erp-space-3);
  padding: var(--erp-space-3);
  background: #f7f8fa;
  border-radius: var(--erp-radius-base);
  font-size: 13px;
}

.lang-diff ul {
  max-height: 220px;
  margin: var(--erp-space-2) 0 0;
  padding-left: 18px;
  overflow: auto;
}

.diff-added {
  color: #52c41a;
}

.diff-changed {
  color: #faad14;
}

.diff-removed {
  color: #f5222d;
}
</style>
