<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { fetchProducts, fetchVariants, type Product, type ProductVariant } from '@/api/master-data'
import type { PageQuery } from '@/types/contract'

const products = ref<Product[]>([])
const selected = ref<Product | null>(null)
const variants = ref<ProductVariant[]>([])
const loading = ref(false)
const query = ref<PageQuery>({ page: 1, pageSize: 100, keyword: '' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchProducts(query.value)
    if (current !== seq) return
    products.value = result.list
    if (!selected.value && result.list.length > 0) selected.value = result.list[0]
    if (selected.value) variants.value = await fetchVariants(selected.value.id)
  } finally { if (current === seq) loading.value = false }
}
async function selectProduct(product: Product): Promise<void> {
  selected.value = product
  variants.value = await fetchVariants(product.id)
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>条码标签</h2><p>按产品查看 SKU 条码；完整标签设计器在打印中心扩展。</p></header>
    <div class="barcode-layout">
      <article class="panel">
        <el-input v-model="query.keyword" placeholder="搜索产品" clearable @keyup.enter="load" />
        <el-table v-loading="loading" :data="products" row-key="id" highlight-current-row @row-click="selectProduct" class="product-table">
          <el-table-column prop="productCode" label="产品编码" width="130" />
          <el-table-column prop="productName" label="产品名称" min-width="160" />
        </el-table>
      </article>
      <article class="panel">
        <h3>{{ selected?.productName ?? 'SKU 条码' }}</h3>
        <div class="label-grid">
          <div v-for="variant in variants" :key="variant.id" class="label-card">
            <div class="barcode-line"></div>
            <strong>{{ variant.skuCode }}</strong>
            <span>{{ variant.barcode || variant.skuCode }}</span>
          </div>
        </div>
        <el-empty v-if="variants.length === 0" description="暂无 SKU" />
      </article>
    </div>
  </section>
</template>

<style scoped>
.barcode-layout { display: grid; grid-template-columns: minmax(320px, 0.8fr) minmax(460px, 1.2fr); gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin: 0 0 16px; }
.product-table { margin-top: 16px; }
.label-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.label-card { padding: 12px; border: 1px dashed #c9cdd4; border-radius: 6px; text-align: center; }
.label-card strong, .label-card span { display: block; }
.barcode-line { height: 34px; margin-bottom: 8px; background: repeating-linear-gradient(90deg, #1f2329 0 2px, #fff 2px 4px, #1f2329 4px 5px, #fff 5px 8px); }
@media (max-width: 1000px) { .barcode-layout { grid-template-columns: 1fr; } }
</style>
