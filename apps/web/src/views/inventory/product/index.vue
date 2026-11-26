<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createProduct,
  createUnitConversion,
  deleteProduct,
  deleteUnitConversion,
  fetchBrands,
  fetchCategories,
  fetchProducts,
  fetchUnitConversions,
  fetchUnits,
  fetchVariants,
  type LookupItem,
  type Product,
  type ProductVariant,
  type UnitConversion
} from '@/api/master-data'
import type { PageQuery } from '@/types/contract'

interface SkuDraft {
  skuCode: string
  attributes: Record<string, string>
  cost: string
  price: string
}

const rows = ref<Product[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const selected = ref<Product | null>(null)
const variants = ref<ProductVariant[]>([])
const detailLoading = ref(false)
const dialogVisible = ref(false)
const activeStep = ref(0)
const categories = ref<LookupItem[]>([])
const brands = ref<LookupItem[]>([])
const units = ref<LookupItem[]>([])
const attributeRows = reactive([{ name: '颜色', values: '黑,白' }])
const skuDrafts = ref<SkuDraft[]>([])
const conversions = ref<UnitConversion[]>([])
const unitForm = reactive({ unitId: 0, conversionRate: '1', isBase: 'NO' })
const form = reactive({
  productCode: '',
  productName: '',
  barcode: '',
  categoryId: 0,
  brandId: 0,
  unitId: 0,
  productType: 'STANDARD',
  trackingType: 'NONE',
  cost: '0',
  price: '0',
  defaultWarehouseId: 0,
  defaultLocationId: 0,
  attributesText: ''
})

let requestSeq = 0
let detailSeq = 0

const canSubmit = computed(() => form.productCode.length > 0 && form.productName.length > 0 && skuDrafts.value.length > 0)

function skuValue(row: unknown, key: 'skuCode' | 'cost' | 'price'): string {
  return (row as SkuDraft)[key]
}

function setSkuValue(row: unknown, key: 'skuCode' | 'cost' | 'price', value: string): void {
  ;(row as SkuDraft)[key] = value
}

function skuAttributes(row: unknown): string {
  return JSON.stringify((row as SkuDraft).attributes)
}

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchProducts(query.value)
    if (seq !== requestSeq) return
    rows.value = result.list
    total.value = result.total
    if (!selected.value && result.list.length > 0) selected.value = result.list[0]
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function loadVariants(value: Product | null): Promise<void> {
  if (!value) {
    variants.value = []
    return
  }
  const seq = ++detailSeq
  detailLoading.value = true
  try {
    const result = await fetchVariants(value.id)
    if (seq === detailSeq) variants.value = result
  } catch (cause) {
    if (seq === detailSeq) error.value = cause instanceof Error ? cause.message : 'SKU 加载失败'
  } finally {
    if (seq === detailSeq) detailLoading.value = false
  }
}

watch(selected, (value) => {
  void loadVariants(value)
  void loadConversions(value)
})

/** 解析产品属性文本（每行 key:value） */
function parseAttributes(): Record<string, string> | undefined {
  const text = form.attributesText.trim()
  if (!text) return undefined
  const result: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const [key, ...rest] = line.split(':')
    const name = key.trim()
    if (!name) continue
    result[name] = rest.join(':').trim()
  }
  return Object.keys(result).length > 0 ? result : undefined
}

async function loadConversions(value: Product | null): Promise<void> {
  if (!value) {
    conversions.value = []
    return
  }
  try {
    conversions.value = await fetchUnitConversions(value.id)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '单位换算加载失败'
  }
}

async function saveConversion(): Promise<void> {
  if (!selected.value || !unitForm.unitId) {
    ElMessage.warning('请选择计量单位')
    return
  }
  try {
    await createUnitConversion({
      productId: selected.value.id,
      unitId: unitForm.unitId,
      conversionRate: unitForm.conversionRate,
      isBase: unitForm.isBase
    })
    ElMessage.success('单位换算已保存')
    unitForm.conversionRate = '1'
    unitForm.isBase = 'NO'
    await loadConversions(selected.value)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function removeConversion(row: UnitConversion): Promise<void> {
  try {
    await deleteUnitConversion(row.id)
    ElMessage.success('单位换算已删除')
    if (selected.value) await loadConversions(selected.value)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '删除失败')
  }
}

function selectRow(row: unknown): void {
  selected.value = row as Product
}

async function openCreate(): Promise<void> {
  activeStep.value = 0
  form.productCode = ''
  form.productName = ''
  form.barcode = ''
  form.categoryId = 0
  form.brandId = 0
  form.unitId = 0
  form.productType = 'STANDARD'
  form.trackingType = 'NONE'
  form.cost = '0'
  form.price = '0'
  form.defaultWarehouseId = 0
  form.defaultLocationId = 0
  form.attributesText = ''
  attributeRows.splice(0, attributeRows.length, { name: '颜色', values: '黑,白' })
  skuDrafts.value = []
  dialogVisible.value = true
  if (categories.value.length === 0) {
    const [categoryList, brandList, unitList] = await Promise.all([fetchCategories(), fetchBrands(), fetchUnits()])
    categories.value = categoryList
    brands.value = brandList
    units.value = unitList
  }
}

function generateSkus(): void {
  const matrices = attributeRows
    .map((row) => ({
      name: row.name.trim(),
      values: row.values.split(',').map((value) => value.trim()).filter(Boolean)
    }))
    .filter((row) => row.name && row.values.length > 0)

  if (matrices.length === 0) {
    skuDrafts.value = [{ skuCode: `${form.productCode}-STD`, attributes: {}, cost: form.cost, price: form.price }]
    return
  }

  let combinations: Record<string, string>[] = [{}]
  for (const matrix of matrices) {
    const next: Record<string, string>[] = []
    for (const combination of combinations) {
      for (const value of matrix.values) {
        next.push({ ...combination, [matrix.name]: value })
      }
    }
    combinations = next
  }

  skuDrafts.value = combinations.map((attributes, index) => ({
    skuCode: `${form.productCode}-${index + 1}`,
    attributes,
    cost: form.cost,
    price: form.price
  }))
}

async function handleSubmit(): Promise<void> {
  if (!canSubmit.value) {
    ElMessage.warning('请填写产品编码、名称并至少生成一个 SKU')
    return
  }
  try {
    await createProduct({
      productCode: form.productCode,
      productName: form.productName,
      barcode: form.barcode || undefined,
      categoryId: form.categoryId || undefined,
      brandId: form.brandId || undefined,
      unitId: form.unitId || undefined,
      productType: form.productType,
      trackingType: form.trackingType,
      cost: form.cost,
      price: form.price,
      defaultWarehouseId: form.defaultWarehouseId || undefined,
      defaultLocationId: form.defaultLocationId || undefined,
      attributes: parseAttributes(),
      variants: skuDrafts.value.map((draft) => ({
        skuCode: draft.skuCode,
        attributes: draft.attributes,
        cost: draft.cost,
        price: draft.price
      }))
    })
    dialogVisible.value = false
    ElMessage.success('产品已创建')
    selected.value = null
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

function attributeText(row: unknown): string {
  const value = (row as ProductVariant).attributes
  if (!value) return '—'
  return Object.entries(value).map(([key, item]) => `${key}:${item}`).join(' / ')
}

function trackingLabel(row: unknown): string {
  const value = (row as Product).trackingType
  if (value === 'BATCH') return '批次'
  if (value === 'SERIAL') return '序列号'
  return '无'
}

async function removeProduct(): Promise<void> {
  if (!selected.value) return
  await ElMessageBox.confirm(`确认删除产品「${selected.value.productName}」？`, '提示', { type: 'warning' })
  await deleteProduct(selected.value.id)
  selected.value = null
  ElMessage.success('已删除')
  await load()
}

onMounted(load)
onUnmounted(() => {
  requestSeq += 1
  detailSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>产品与 SKU</h2>
      <p>分步创建产品：基础信息 → 属性定义 → SKU 矩阵；SKU 编码在租户内唯一。</p>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="product-layout">
      <article class="panel">
        <div class="panel-toolbar">
          <el-input v-model="query.keyword" placeholder="搜索产品" clearable @keyup.enter="load" />
          <el-button type="primary" v-perm="'inventory:product:create'" @click="openCreate">新建产品</el-button>
          <el-button @click="load">刷新</el-button>
        </div>
        <el-table v-loading="loading" :data="rows" row-key="id" highlight-current-row @row-click="selectRow">
          <el-table-column prop="productCode" label="产品编码" width="120" />
          <el-table-column prop="productName" label="产品名称" min-width="150" />
          <el-table-column prop="price" label="价格" width="110" />
          <el-table-column label="追踪" width="90">
            <template #default="{ row }">{{ trackingLabel(row) }}</template>
          </el-table-column>
        </el-table>
        <el-pagination background layout="prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" />
      </article>

      <article class="panel" v-loading="detailLoading">
        <div class="detail-header">
          <h3>{{ selected?.productName ?? '产品详情' }}</h3>
          <el-button type="danger" v-perm="'inventory:product:delete'" :disabled="!selected" @click="removeProduct">删除</el-button>
        </div>
        <el-descriptions v-if="selected" :column="2" border>
          <el-descriptions-item label="产品编码">{{ selected.productCode }}</el-descriptions-item>
          <el-descriptions-item label="条码">{{ selected.barcode || '—' }}</el-descriptions-item>
          <el-descriptions-item label="成本">{{ selected.cost }}</el-descriptions-item>
          <el-descriptions-item label="价格">{{ selected.price }}</el-descriptions-item>
        </el-descriptions>
        <h4 class="section-title">SKU 矩阵</h4>
        <el-table :data="variants" row-key="id" size="small">
          <el-table-column prop="skuCode" label="SKU" width="150" />
          <el-table-column label="属性" min-width="180">
            <template #default="{ row }">{{ attributeText(row) }}</template>
          </el-table-column>
          <el-table-column prop="barcode" label="条码" width="140" />
          <el-table-column prop="cost" label="成本" width="100" />
          <el-table-column prop="price" label="价格" width="100" />
        </el-table>
        <h4 class="section-title">多单位换算</h4>
        <el-form inline>
          <el-form-item label="计量单位">
            <el-select v-model="unitForm.unitId" placeholder="选择单位" style="width: 180px">
              <el-option v-for="item in units" :key="item.id" :label="`${item.unitName ?? ''} (${item.unitCode ?? ''})`" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="换算率"><el-input v-model="unitForm.conversionRate" style="width: 120px" /></el-form-item>
          <el-form-item label="基准单位">
            <el-select v-model="unitForm.isBase" style="width: 110px">
              <el-option label="否" value="NO" />
              <el-option label="是" value="YES" />
            </el-select>
          </el-form-item>
          <el-button type="primary" v-perm="'inventory:product:update'" :disabled="!selected" @click="saveConversion">新增换算</el-button>
        </el-form>
        <el-table :data="conversions" row-key="id" size="small">
          <el-table-column prop="unitCode" label="单位编码" width="120" />
          <el-table-column prop="unitName" label="单位名称" width="140" />
          <el-table-column prop="conversionRate" label="换算率" width="110" />
          <el-table-column prop="baseQty" label="折合基准数量" width="130" />
          <el-table-column label="基准" width="90">
            <template #default="{ row }">
              <el-tag :type="row.isBase === 1 ? 'success' : 'info'">{{ row.isBase === 1 ? '基准' : '非基准' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="danger" v-perm="'inventory:product:update'" @click="removeConversion(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </article>
    </div>

    <el-dialog v-model="dialogVisible" title="新建产品" width="860px">
      <el-steps :active="activeStep" align-center finish-status="success">
        <el-step title="基础信息" />
        <el-step title="属性定义" />
        <el-step title="SKU 矩阵" />
      </el-steps>

      <div v-show="activeStep === 0" class="step-body">
        <el-form label-width="90px">
          <el-form-item label="产品编码"><el-input v-model="form.productCode" /></el-form-item>
          <el-form-item label="产品名称"><el-input v-model="form.productName" /></el-form-item>
          <el-form-item label="条码"><el-input v-model="form.barcode" /></el-form-item>
          <el-form-item label="分类">
            <el-select v-model="form.categoryId">
              <el-option v-for="item in categories" :key="item.id" :label="item.categoryName ?? ''" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="品牌">
            <el-select v-model="form.brandId">
              <el-option v-for="item in brands" :key="item.id" :label="item.brandName ?? ''" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="单位">
            <el-select v-model="form.unitId">
              <el-option v-for="item in units" :key="item.id" :label="item.unitName ?? ''" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="追踪方式">
            <el-select v-model="form.trackingType">
              <el-option label="无" value="NONE" />
              <el-option label="批次" value="BATCH" />
              <el-option label="序列号" value="SERIAL" />
            </el-select>
          </el-form-item>
          <el-form-item label="默认仓库ID"><el-input-number v-model="form.defaultWarehouseId" :min="0" /></el-form-item>
          <el-form-item label="默认库位ID"><el-input-number v-model="form.defaultLocationId" :min="0" /></el-form-item>
          <el-form-item label="产品属性">
            <el-input v-model="form.attributesText" type="textarea" :rows="3" placeholder="每行一个属性，格式：材质:不锈钢" />
          </el-form-item>
          <el-form-item label="成本/价格">
            <div class="inline-fields">
              <el-input v-model="form.cost" placeholder="成本" />
              <el-input v-model="form.price" placeholder="价格" />
            </div>
          </el-form-item>
        </el-form>
      </div>

      <div v-show="activeStep === 1" class="step-body">
        <div v-for="(row, index) in attributeRows" :key="index" class="attribute-row">
          <el-input v-model="row.name" placeholder="属性名，如颜色" />
          <el-input v-model="row.values" placeholder="属性值，用逗号分隔" />
          <el-button :disabled="attributeRows.length <= 1" @click="attributeRows.splice(index, 1)">删除</el-button>
        </div>
        <el-button @click="attributeRows.push({ name: '', values: '' })">添加属性</el-button>
        <el-button type="primary" @click="generateSkus">生成 SKU</el-button>
      </div>

      <div v-show="activeStep === 2" class="step-body">
        <el-table :data="skuDrafts" row-key="skuCode" size="small">
          <el-table-column label="SKU 编码" width="180">
            <template #default="{ row }">
              <el-input :model-value="skuValue(row, 'skuCode')" @update:model-value="setSkuValue(row, 'skuCode', $event)" />
            </template>
          </el-table-column>
          <el-table-column label="属性" min-width="200">
            <template #default="{ row }">{{ skuAttributes(row) }}</template>
          </el-table-column>
          <el-table-column label="成本" width="120">
            <template #default="{ row }">
              <el-input :model-value="skuValue(row, 'cost')" @update:model-value="setSkuValue(row, 'cost', $event)" />
            </template>
          </el-table-column>
          <el-table-column label="价格" width="120">
            <template #default="{ row }">
              <el-input :model-value="skuValue(row, 'price')" @update:model-value="setSkuValue(row, 'price', $event)" />
            </template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button v-if="activeStep > 0" @click="activeStep -= 1">上一步</el-button>
        <el-button v-if="activeStep < 2" type="primary" @click="activeStep += 1">下一步</el-button>
        <el-button v-else type="primary" :disabled="!canSubmit" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.product-layout { display: grid; grid-template-columns: minmax(380px, 0.9fr) minmax(460px, 1.1fr); gap: 16px; }
.panel { min-width: 0; padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.detail-header h3 { margin: 0; }
.section-title { margin: 20px 0 12px; }
.step-body { min-height: 340px; padding: 16px 0; }
.inline-fields { display: flex; gap: 8px; }
.attribute-row { display: flex; gap: 8px; margin-bottom: 12px; }
.error-banner { margin-bottom: 16px; padding: 12px 16px; color: #f5222d; background: #fff1f0; border-radius: 8px; }
@media (max-width: 1100px) { .product-layout { grid-template-columns: 1fr; } }
</style>
