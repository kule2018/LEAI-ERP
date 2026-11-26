<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createDictItem,
  createDictType,
  deleteDictItem,
  deleteDictType,
  downloadDictCsv,
  fetchDictItems,
  fetchDictTypes,
  importDictCsv,
  updateDictItem,
  updateDictType,
  type DictImportResult,
  type DictItem,
  type DictType
} from '@/api/dict'
import type { PageQuery } from '@/types/contract'

const types = ref<DictType[]>([])
const items = ref<DictItem[]>([])
const selectedType = ref<DictType | null>(null)
const typeLoading = ref(false)
const itemLoading = ref(false)
const error = ref('')
const typeQuery = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const itemQuery = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const typeTotal = ref(0)
const itemTotal = ref(0)
const typeDialog = ref(false)
const itemDialog = ref(false)
const typeEditingId = ref(0)
const itemEditingId = ref(0)
const typeForm = reactive({ dictType: '', dictName: '', remark: '' })
const itemForm = reactive({ dictType: '', itemCode: '', itemLabel: '', itemValue: '', sortNo: 0 })

const importVisible = ref(false)
const importContent = ref('字典编码,字典名称,项编码,项名称,项值,排序,状态\n')
const importResult = ref<DictImportResult | null>(null)

async function doExport(): Promise<void> {
  const blob = await downloadDictCsv()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `dict-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  ElMessage.success('字典已导出')
}

async function doImport(dryRun: boolean): Promise<void> {
  const result = await importDictCsv(importContent.value, dryRun)
  importResult.value = result
  ElMessage.success(dryRun ? '导入预览已生成' : `导入完成：新增 ${result.createdItems} 项`)
  if (!dryRun) {
    importVisible.value = false
    await loadTypes()
  }
}

let typeSeq = 0
let itemSeq = 0

async function loadTypes(): Promise<void> {
  const seq = ++typeSeq
  typeLoading.value = true
  error.value = ''
  try {
    const result = await fetchDictTypes(typeQuery.value)
    if (seq !== typeSeq) return
    types.value = result.list
    typeTotal.value = result.total
  } catch (cause) {
    if (seq === typeSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === typeSeq) typeLoading.value = false
  }
}

async function loadItems(): Promise<void> {
  if (!selectedType.value) {
    items.value = []
    return
  }
  const seq = ++itemSeq
  itemLoading.value = true
  try {
    const result = await fetchDictItems({ ...itemQuery.value, dictType: selectedType.value.dictType })
    if (seq !== itemSeq) return
    items.value = result.list
    itemTotal.value = result.total
  } catch (cause) {
    if (seq === itemSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === itemSeq) itemLoading.value = false
  }
}

function selectType(row: DictType): void {
  selectedType.value = row
  itemQuery.value.page = 1
  void loadItems()
}

function handleEditType(row: unknown): void {
  openTypeEdit(row as DictType)
}

async function handleRemoveType(row: unknown): Promise<void> {
  await removeType(row as DictType)
}

function handleEditItem(row: unknown): void {
  openItemEdit(row as DictItem)
}

async function handleRemoveItem(row: unknown): Promise<void> {
  await removeItem(row as DictItem)
}

function openTypeAdd(): void {
  typeEditingId.value = 0
  typeForm.dictType = ''
  typeForm.dictName = ''
  typeForm.remark = ''
  typeDialog.value = true
}

function openTypeEdit(row: DictType): void {
  typeEditingId.value = row.id
  typeForm.dictType = row.dictType
  typeForm.dictName = row.dictName
  typeForm.remark = row.remark ?? ''
  typeDialog.value = true
}

async function saveType(): Promise<void> {
  try {
    if (typeEditingId.value > 0) {
      await updateDictType(typeEditingId.value, { dictName: typeForm.dictName, remark: typeForm.remark })
    } else {
      await createDictType({ dictType: typeForm.dictType, dictName: typeForm.dictName, remark: typeForm.remark })
    }
    typeDialog.value = false
    ElMessage.success('保存成功')
    await loadTypes()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function removeType(row: DictType): Promise<void> {
  await ElMessageBox.confirm(`确认删除字典「${row.dictName}」？`, '提示', { type: 'warning' })
  await deleteDictType(row.id)
  if (selectedType.value?.id === row.id) selectedType.value = null
  ElMessage.success('已删除')
  await loadTypes()
}

function openItemAdd(): void {
  if (!selectedType.value) return
  itemEditingId.value = 0
  itemForm.dictType = selectedType.value.dictType
  itemForm.itemCode = ''
  itemForm.itemLabel = ''
  itemForm.itemValue = ''
  itemForm.sortNo = 0
  itemDialog.value = true
}

function openItemEdit(row: DictItem): void {
  itemEditingId.value = row.id
  itemForm.dictType = row.dictType
  itemForm.itemCode = row.itemCode
  itemForm.itemLabel = row.itemLabel
  itemForm.itemValue = row.itemValue ?? ''
  itemForm.sortNo = row.sortNo
  itemDialog.value = true
}

async function saveItem(): Promise<void> {
  try {
    if (itemEditingId.value > 0) {
      await updateDictItem(itemEditingId.value, {
        itemLabel: itemForm.itemLabel,
        itemValue: itemForm.itemValue,
        sortNo: itemForm.sortNo
      })
    } else {
      await createDictItem({
        dictType: itemForm.dictType,
        itemCode: itemForm.itemCode,
        itemLabel: itemForm.itemLabel,
        itemValue: itemForm.itemValue,
        sortNo: itemForm.sortNo
      })
    }
    itemDialog.value = false
    ElMessage.success('保存成功')
    await loadItems()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function removeItem(row: DictItem): Promise<void> {
  await ElMessageBox.confirm(`确认删除字典项「${row.itemLabel}」？`, '提示', { type: 'warning' })
  await deleteDictItem(row.id)
  ElMessage.success('已删除')
  await loadItems()
}

onMounted(loadTypes)
onUnmounted(() => {
  typeSeq += 1
  itemSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>字典管理</h2>
      <p>左侧维护字典类型，右侧维护字典项；字典项写入后自动刷新 Redis 缓存。</p>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="dict-layout">
      <article class="panel">
        <div class="panel-toolbar">
          <el-input v-model="typeQuery.keyword" placeholder="搜索字典类型" clearable @keyup.enter="loadTypes" />
          <el-button type="primary" v-perm="'system:dict:create'" @click="openTypeAdd">新增</el-button>
          <el-button v-perm="'system:dict:view'" @click="doExport">导出</el-button>
          <el-button v-perm="'system:dict:create'" @click="importVisible = true">导入</el-button>
          <el-button @click="loadTypes">刷新</el-button>
        </div>
        <el-table v-loading="typeLoading" :data="types" row-key="id" highlight-current-row @row-click="selectType">
          <el-table-column prop="dictType" label="字典类型" min-width="120" />
          <el-table-column prop="dictName" label="字典名称" min-width="140" />
          <el-table-column prop="status" label="状态" width="90" />
          <el-table-column label="操作" width="120" align="center">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'system:dict:update'" @click.stop="handleEditType(row)">编辑</el-button>
              <el-button link type="danger" v-perm="'system:dict:delete'" @click.stop="handleRemoveType(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          background
          layout="prev, pager, next"
          :total="typeTotal"
          :current-page="typeQuery.page"
          :page-size="typeQuery.pageSize"
          @current-change="(value: number) => { typeQuery.page = value; void loadTypes() }"
        />
      </article>

      <article class="panel">
        <div class="panel-toolbar">
          <span class="panel-title">{{ selectedType ? `${selectedType.dictName} · 字典项` : '请选择左侧字典类型' }}</span>
          <el-button type="primary" :disabled="!selectedType" v-perm="'system:dict:create'" @click="openItemAdd">新增项</el-button>
        </div>
        <el-table v-loading="itemLoading" :data="items" row-key="id">
          <el-table-column prop="itemCode" label="编码" width="120" />
          <el-table-column prop="itemLabel" label="名称" min-width="140" />
          <el-table-column prop="itemValue" label="值" min-width="120" />
          <el-table-column prop="sortNo" label="排序" width="80" />
          <el-table-column label="操作" width="120" align="center">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'system:dict:update'" @click="handleEditItem(row)">编辑</el-button>
              <el-button link type="danger" v-perm="'system:dict:delete'" @click="handleRemoveItem(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </article>
    </div>

    <el-dialog v-model="importVisible" title="字典 CSV 导入" width="640px">
      <el-alert v-if="importResult" type="info" :closable="false" style="margin-bottom: 12px"
        :title="`预览：共 ${importResult.total ?? 0} 行，新增类型 ${importResult.createdTypes ?? importResult.summary?.newDicts ?? 0}，新增项 ${importResult.createdItems ?? 0}，重复 ${importResult.summary?.duplicateInFile ?? 0}`" />
      <el-input v-model="importContent" type="textarea" :rows="10" placeholder="字典编码,字典名称,项编码,项名称,项值,排序,状态" />
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button v-perm="'system:dict:create'" @click="doImport(true)">预览</el-button>
        <el-button type="primary" v-perm="'system:dict:create'" @click="doImport(false)">确认导入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="typeDialog" :title="typeEditingId ? '编辑字典类型' : '新增字典类型'" width="480px">
      <el-form label-width="90px">
        <el-form-item label="字典类型">
          <el-input v-model="typeForm.dictType" :disabled="typeEditingId > 0" />
        </el-form-item>
        <el-form-item label="字典名称">
          <el-input v-model="typeForm.dictName" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="typeForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="typeDialog = false">取消</el-button>
        <el-button type="primary" @click="saveType">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="itemDialog" :title="itemEditingId ? '编辑字典项' : '新增字典项'" width="520px">
      <el-form label-width="90px">
        <el-form-item label="字典类型">
          <el-input v-model="itemForm.dictType" disabled />
        </el-form-item>
        <el-form-item label="编码">
          <el-input v-model="itemForm.itemCode" :disabled="itemEditingId > 0" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="itemForm.itemLabel" />
        </el-form-item>
        <el-form-item label="值">
          <el-input v-model="itemForm.itemValue" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="itemForm.sortNo" :min="0" :max="9999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemDialog = false">取消</el-button>
        <el-button type="primary" @click="saveItem">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.error-banner {
  margin-bottom: 16px;
  padding: 12px 16px;
  color: #f5222d;
  background: #fff1f0;
  border-radius: 8px;
}

.dict-layout {
  display: grid;
  grid-template-columns: minmax(360px, 0.9fr) minmax(420px, 1.1fr);
  gap: 16px;
}

.panel {
  min-width: 0;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.panel-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.panel-title {
  flex: 1;
  font-weight: 600;
}

@media (max-width: 960px) {
  .dict-layout {
    grid-template-columns: 1fr;
  }
}
</style>
