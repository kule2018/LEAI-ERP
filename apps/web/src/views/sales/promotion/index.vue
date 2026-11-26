<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createPromotionBundle,
  fetchPromotionBundles,
  previewPromotionBundle,
  updatePromotionBundle,
  type BundlePreview,
  type PromotionBundle
} from '@/api/sales-delivery'

interface ItemDraft {
  productId: number
  qty: string
}

const bundles = ref<PromotionBundle[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const preview = ref<BundlePreview | null>(null)
const previewLines = ref<ItemDraft[]>([{ productId: 0, qty: '1' }])

const form = reactive({
  promotionCode: '',
  promotionName: '',
  bundleType: 'COMBO',
  comboPrice: '',
  thresholdAmount: '',
  discountAmount: '',
  startDate: '',
  endDate: '',
  priority: 0,
  remark: '',
  items: [] as ItemDraft[]
})

function money(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00'
}

function typeLabel(type: string): string {
  return type === 'FULL_REDUCTION' ? '满减' : '套装'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchPromotionBundles({ page: 1, pageSize: 100 })
    bundles.value = result.list
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  editingId.value = null
  Object.assign(form, {
    promotionCode: '',
    promotionName: '',
    bundleType: 'COMBO',
    comboPrice: '',
    thresholdAmount: '',
    discountAmount: '',
    startDate: '',
    endDate: '',
    priority: 0,
    remark: '',
    items: [{ productId: 0, qty: '1' }]
  })
  dialogVisible.value = true
}

function openEdit(row: PromotionBundle): void {
  editingId.value = row.id
  Object.assign(form, {
    promotionCode: row.promotionCode,
    promotionName: row.promotionName,
    bundleType: row.bundleType,
    comboPrice: row.comboPrice ?? '',
    thresholdAmount: row.thresholdAmount ?? '',
    discountAmount: row.discountAmount ?? '',
    startDate: row.startDate ?? '',
    endDate: row.endDate ?? '',
    priority: row.priority,
    remark: row.remark ?? '',
    items: (row.items ?? []).map((item) => ({ productId: item.productId, qty: String(item.qty) }))
  })
  dialogVisible.value = true
}

function addItem(): void {
  form.items.push({ productId: 0, qty: '1' })
}

function removeItem(index: number): void {
  form.items.splice(index, 1)
}

async function save(): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      promotionName: form.promotionName,
      bundleType: form.bundleType,
      priority: form.priority,
      remark: form.remark || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      items: form.items.map((item) => ({ productId: item.productId, qty: item.qty || '1' }))
    }
    if (form.bundleType === 'COMBO') payload.comboPrice = form.comboPrice || '0'
    else {
      payload.thresholdAmount = form.thresholdAmount || '0'
      payload.discountAmount = form.discountAmount || '0'
    }
    if (editingId.value) {
      await updatePromotionBundle(editingId.value, payload)
    } else {
      await createPromotionBundle({ ...payload, promotionCode: form.promotionCode })
    }
    dialogVisible.value = false
    ElMessage.success(editingId.value ? '促销已更新' : '促销已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function toggleStatus(row: PromotionBundle): Promise<void> {
  try {
    await updatePromotionBundle(row.id, { status: row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED' })
    ElMessage.success(row.status === 'ENABLED' ? '已停用' : '已启用')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
  }
}

async function runPreview(): Promise<void> {
  const lines = previewLines.value.filter((line) => Number(line.productId) > 0)
  if (lines.length === 0) {
    ElMessage.warning('请填写商品 ID 与数量')
    return
  }
  try {
    preview.value = await previewPromotionBundle({ lines })
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '试算失败')
  }
}

onMounted(load)
</script>

<template>
  <div class="promotion-page" v-loading="loading">
    <section class="bundle-list">
      <header class="list-head">
        <h3>组合促销</h3>
        <el-button type="primary" size="small" @click="openCreate">新建促销</el-button>
      </header>
      <article v-for="row in bundles" :key="row.id" class="bundle-card" :class="row.bundleType === 'COMBO' ? 'combo' : 'reduction'">
        <div class="card-top">
          <span class="name">{{ row.promotionName }}</span>
          <el-tag size="small" :type="row.bundleType === 'COMBO' ? 'warning' : 'success'">{{ typeLabel(row.bundleType) }}</el-tag>
        </div>
        <div class="code">{{ row.promotionCode }} · 优先级 {{ row.priority }}</div>
        <div class="rule">
          <template v-if="row.bundleType === 'COMBO'">
            套装价 {{ money(row.comboPrice) }} · 成分 {{ row.items?.length ?? 0 }} 项
          </template>
          <template v-else>
            满 {{ money(row.thresholdAmount) }} 减 {{ money(row.discountAmount) }}
          </template>
        </div>
        <div class="period">{{ row.startDate || '不限' }} ~ {{ row.endDate || '不限' }}</div>
        <div class="card-foot">
          <el-tag size="small" :type="row.status === 'ENABLED' ? 'success' : 'info'">{{ row.status === 'ENABLED' ? '启用中' : '已停用' }}</el-tag>
          <span class="spacer" />
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" @click="toggleStatus(row)">{{ row.status === 'ENABLED' ? '停用' : '启用' }}</el-button>
        </div>
      </article>
      <el-empty v-if="bundles.length === 0" description="暂无组合促销" :image-size="60" />
    </section>

    <section class="preview-panel">
      <header class="list-head">
        <h3>促销试算</h3>
        <el-button size="small" type="primary" @click="runPreview">试算</el-button>
      </header>
      <div class="preview-lines">
        <div v-for="(line, index) in previewLines" :key="index" class="preview-line">
          <el-input-number v-model="line.productId" :min="0" :step="1" placeholder="商品 ID" controls-position="right" />
          <el-input v-model="line.qty" placeholder="数量" style="width: 90px" />
          <el-button size="small" text type="danger" @click="previewLines.splice(index, 1)">移除</el-button>
        </div>
        <el-button size="small" @click="previewLines.push({ productId: 0, qty: '1' })">添加商品</el-button>
      </div>

      <div v-if="preview" class="preview-result">
        <div class="result-head">
          <span>订单金额 {{ money(preview.orderAmount) }}</span>
          <span class="discount">优惠 {{ money(preview.totalDiscount) }}</span>
        </div>
        <div v-if="preview.applied.length === 0" class="empty">当前无命中促销</div>
        <div v-for="item in preview.applied" :key="item.bundleId" class="applied-card">
          <div class="applied-title">{{ item.name }}（{{ item.code }}）</div>
          <div class="applied-reason">{{ item.reason }}</div>
          <div class="applied-amount">- {{ money(item.discountAmount) }}</div>
        </div>
        <div v-if="preview.candidates.length > preview.applied.length" class="candidates">
          <div class="candidates-title">其他可用（因商品行重叠未叠加）</div>
          <div v-for="item in preview.candidates" :key="`c-${item.bundleId}`" class="candidate">
            {{ item.name }} · {{ item.reason }} · - {{ money(item.discountAmount) }}
          </div>
        </div>
      </div>
    </section>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑组合促销' : '新建组合促销'" width="620px">
      <el-form label-width="110px">
        <el-form-item v-if="!editingId" label="促销编码">
          <el-input v-model="form.promotionCode" placeholder="如 BUNDLE-2026-01" />
        </el-form-item>
        <el-form-item label="促销名称"><el-input v-model="form.promotionName" /></el-form-item>
        <el-form-item label="促销类型">
          <el-radio-group v-model="form.bundleType" :disabled="Boolean(editingId)">
            <el-radio value="COMBO">套装价</el-radio>
            <el-radio value="FULL_REDUCTION">满减</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.bundleType === 'COMBO'" label="套装价">
          <el-input v-model="form.comboPrice" placeholder="按标准合计低于该价时生效" />
        </el-form-item>
        <template v-else>
          <el-form-item label="满减门槛"><el-input v-model="form.thresholdAmount" /></el-form-item>
          <el-form-item label="优惠金额"><el-input v-model="form.discountAmount" /></el-form-item>
        </template>
        <el-form-item label="生效期间">
          <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" placeholder="开始" style="width: 160px" />
          <el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" placeholder="结束" style="width: 160px; margin-left: 8px" />
        </el-form-item>
        <el-form-item label="优先级"><el-input-number v-model="form.priority" :min="0" /></el-form-item>
        <el-form-item v-if="form.bundleType === 'COMBO'" label="套装成分">
          <div class="item-editor">
            <div v-for="(item, index) in form.items" :key="index" class="item-row">
              <el-input-number v-model="item.productId" :min="0" :step="1" placeholder="商品 ID" controls-position="right" />
              <el-input v-model="item.qty" placeholder="数量" style="width: 90px" />
              <el-button size="small" text type="danger" @click="removeItem(index)">移除</el-button>
            </div>
            <el-button size="small" @click="addItem">添加成分</el-button>
          </div>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.promotion-page { display: grid; grid-template-columns: 1fr 380px; gap: 12px; }
.bundle-list, .preview-panel {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 12px;
}
.list-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.list-head h3 { margin: 0; font-size: 14px; }
.bundle-card {
  border: 1px solid var(--el-border-color-lighter);
  border-left-width: 4px;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.bundle-card.combo { border-left-color: var(--el-color-warning); }
.bundle-card.reduction { border-left-color: var(--el-color-success); }
.card-top { display: flex; align-items: center; justify-content: space-between; }
.name { font-weight: 600; font-size: 14px; }
.code, .period { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 2px; }
.rule { font-size: 13px; margin-top: 6px; }
.card-foot { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.spacer { flex: 1; }
.preview-lines { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.preview-line { display: flex; gap: 8px; align-items: center; }
.result-head { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
.discount { color: var(--el-color-danger); font-weight: 600; }
.empty { font-size: 12px; color: var(--el-text-color-secondary); }
.applied-card { border: 1px dashed var(--el-color-primary-light-5); border-radius: 6px; padding: 8px; margin-bottom: 8px; }
.applied-title { font-size: 13px; font-weight: 600; }
.applied-reason { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 2px; }
.applied-amount { color: var(--el-color-danger); font-size: 13px; margin-top: 4px; }
.candidates { margin-top: 10px; font-size: 12px; color: var(--el-text-color-secondary); }
.candidates-title { margin-bottom: 4px; }
.item-editor { width: 100%; }
.item-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
</style>
