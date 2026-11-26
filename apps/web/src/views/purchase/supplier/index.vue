<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BaseDrawer from '@/components/BaseDrawer.vue'
import BaseGrid from '@/components/BaseGrid.vue'
import ColumnSetting from '@/components/ColumnSetting.vue'
import CustomFieldPanel from '@/components/CustomFieldPanel.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import {
  createSupplier,
  deleteSupplier,
  fetchSuppliers,
  updateSupplier,
  type Supplier
} from '@/api/master-data'
import { saveCustomValues } from '@/api/custom-field'
import type { FieldDef, GridColumn, PageQuery } from '@/types/contract'
import { useCustomFieldColumns } from '@/utils/custom-field-columns'
import { useViewConfig } from '@/utils/view-config'

const VIEW_PAGE_KEY = 'purchase.supplier'
/** 自定义字段所属业务对象编码 */
const CUSTOM_ENTITY_CODE = 'SUPPLIER'

const columns: GridColumn[] = [
  { prop: 'supplierCode', label: '供应商编码', width: 140 },
  { prop: 'supplierName', label: '供应商名称', width: 180 },
  { prop: 'supplierGroup', label: '分组', width: 120 },
  { prop: 'qualificationStatus', label: '资质状态', width: 130 },
  { prop: 'ratingScore', label: '评级分', width: 100 },
  { prop: 'contactName', label: '联系人', width: 110 },
  { prop: 'status', label: '状态', width: 100 }
]

const fields: FieldDef[] = [
  { key: 'supplierCode', label: '供应商编码', type: 'input', required: true, maxlength: 50 },
  { key: 'supplierName', label: '供应商名称', type: 'input', required: true, maxlength: 150 },
  { key: 'supplierGroup', label: '供应商分组', type: 'input', maxlength: 50 },
  { key: 'qualificationStatus', label: '资质状态', type: 'select', options: [
    { label: '待审核', value: 'PENDING' },
    { label: '合格', value: 'QUALIFIED' },
    { label: '已过期', value: 'EXPIRED' }
  ] },
  { key: 'qualificationExpire', label: '资质到期', type: 'input', maxlength: 10 },
  { key: 'blacklist', label: '黑名单', type: 'select', options: [
    { label: '否', value: 'NO' },
    { label: '是', value: 'YES' }
  ] },
  { key: 'ratingScore', label: '评级分', type: 'input', maxlength: 10 },
  { key: 'contactName', label: '联系人', type: 'input', maxlength: 50 },
  { key: 'contactPhone', label: '联系电话', type: 'input', maxlength: 30 },
  { key: 'bankName', label: '开户行', type: 'input', maxlength: 100 },
  { key: 'bankAccount', label: '银行账号', type: 'input', maxlength: 100 }
]

const rows = ref<Supplier[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const drawerVisible = ref(false)
const isEdit = ref(false)
const editingId = ref(0)
const submitting = ref(false)
const form = ref<Record<string, unknown>>(createEmptyForm())
const customValues = ref<Record<string, unknown>>({})
const { visibleProps, visibleColumns, load: loadViewConfig } = useViewConfig(VIEW_PAGE_KEY, columns)
/** 自定义字段动态列 */
const { customColumns, loadFields: loadCustomFields, loadValues: loadCustomValues } = useCustomFieldColumns(CUSTOM_ENTITY_CODE)
/** 基础列 + 自定义字段列 */
const allColumns = computed<GridColumn[]>(() => [...visibleColumns.value, ...customColumns.value])

let requestSeq = 0

function createEmptyForm(): Record<string, unknown> {
  return {
    supplierCode: '',
    supplierName: '',
    supplierGroup: '',
    qualificationStatus: 'PENDING',
    qualificationExpire: '',
    blacklist: 'NO',
    ratingScore: '0',
    contactName: '',
    contactPhone: '',
    bankName: '',
    bankAccount: ''
  }
}

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchSuppliers(query.value)
    if (seq !== requestSeq) return
    rows.value = result.list
    total.value = result.total
    // 回填自定义字段取值，供动态列展示
    await loadCustomValues(result.list)
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function openAdd(): void {
  isEdit.value = false
  editingId.value = 0
  form.value = createEmptyForm()
  customValues.value = {}
  drawerVisible.value = true
}

function openEdit(row: unknown): void {
  const supplier = row as Supplier
  isEdit.value = true
  editingId.value = supplier.id
  form.value = {
    ...createEmptyForm(),
    supplierCode: supplier.supplierCode,
    supplierName: supplier.supplierName,
    supplierGroup: supplier.supplierGroup ?? '',
    qualificationStatus: supplier.qualificationStatus,
    qualificationExpire: supplier.qualificationExpire ?? '',
    blacklist: supplier.blacklist === 1 ? 'YES' : 'NO',
    ratingScore: supplier.ratingScore,
    contactName: supplier.contactName ?? '',
    contactPhone: supplier.contactPhone ?? ''
  }
  drawerVisible.value = true
}

function buildPayload(): Record<string, unknown> {
  return {
    supplierName: String(form.value.supplierName ?? ''),
    supplierGroup: String(form.value.supplierGroup ?? ''),
    qualificationStatus: String(form.value.qualificationStatus ?? 'PENDING'),
    qualificationExpire: String(form.value.qualificationExpire ?? ''),
    blacklist: String(form.value.blacklist ?? 'NO'),
    ratingScore: String(form.value.ratingScore ?? '0'),
    contactName: String(form.value.contactName ?? ''),
    contactPhone: String(form.value.contactPhone ?? ''),
    bankName: String(form.value.bankName ?? ''),
    bankAccount: String(form.value.bankAccount ?? '')
  }
}

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    const payload = buildPayload()
    let targetId = editingId.value
    if (isEdit.value) {
      await updateSupplier(editingId.value, payload)
    } else {
      const created = await createSupplier({
        supplierCode: String(form.value.supplierCode ?? ''),
        ...payload
      })
      targetId = created.id
    }
    if (Object.keys(customValues.value).length > 0) {
      await saveCustomValues(CUSTOM_ENTITY_CODE, targetId, customValues.value)
    }
    drawerVisible.value = false
    ElMessage.success('保存成功')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: unknown): Promise<void> {
  const supplier = row as Supplier
  await ElMessageBox.confirm(`确认删除供应商「${supplier.supplierName}」？`, '提示', { type: 'warning' })
  await deleteSupplier(supplier.id)
  ElMessage.success('已删除')
  await load()
}

function handlePage(value: number): void {
  query.value.page = value
  void load()
}

function handlePageSize(value: number): void {
  query.value.pageSize = value
  void load()
}

onMounted(() => {
  void loadViewConfig()
  void loadCustomFields()
  void load()
})
onUnmounted(() => {
  requestSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>供应商档案</h2>
      <p>维护供应商资质、评级、黑名单和银行账户；采购下单前将校验黑名单与资质状态。</p>
    </header>

    <BaseGrid
      :columns="allColumns"
      :rows="rows"
      :loading="loading"
      :error="error"
      :total="total"
      :page="query.page"
      :page-size="query.pageSize"
      perm-prefix="purchase:supplier"
      @refresh="load"
      @add="openAdd"
      @edit="openEdit"
      @delete="handleDelete"
      @update:page="handlePage"
      @update:page-size="handlePageSize"
    >
      <template #toolbar>
        <el-input v-model="query.keyword" placeholder="搜索供应商" clearable @keyup.enter="load" />
        <ColumnSetting v-model="visibleProps" :page-key="VIEW_PAGE_KEY" :columns="columns" />
      </template>

      <template #row-extra="{ row }">
        <FavoriteButton
          target-type="RECORD"
          :target-key="`supplier:${row.id}`"
          :title="row.supplierName"
          biz-type="supplier"
          :biz-id="row.id"
        />
      </template>
    </BaseGrid>

    <BaseDrawer
      v-model="drawerVisible"
      :title="isEdit ? '编辑供应商' : '新增供应商'"
      :fields="fields"
      :form="form"
      :loading="submitting"
      :is-edit="isEdit"
      submit-perm="purchase:supplier:update"
      @update:form="form = $event"
      @submit="handleSubmit"
    >
      <template #extra>
        <CustomFieldPanel
          :entity-code="CUSTOM_ENTITY_CODE"
          :biz-id="editingId || null"
          :model-value="customValues"
          :savable="isEdit"
          @update:model-value="customValues = $event"
        />
      </template>
    </BaseDrawer>
  </section>
</template>
