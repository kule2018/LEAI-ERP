<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createPrintLabel, fetchPrintLabels, type PrintLabelTemplate } from '@/api/print'
import type { PageQuery } from '@/types/contract'

const labels = ref<PrintLabelTemplate[]>([])
const total = ref(0)
const loading = ref(false)
const dialogVisible = ref(false)
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const form = reactive({ labelCode: '', labelName: '', barcodeType: 'CODE128', paperSize: '50x30' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchPrintLabels(query)
    labels.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载标签模板失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  form.labelCode = ''
  form.labelName = ''
  form.barcodeType = 'CODE128'
  form.paperSize = '50x30'
  dialogVisible.value = true
}

async function handleCreate(): Promise<void> {
  try {
    await createPrintLabel({ ...form })
    dialogVisible.value = false
    ElMessage.success('标签模板已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '创建失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>标签模板</h2>
      <p>条码标签模板支持 Code128 / EAN / QR，纸张规格按仓库与门店场景配置。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索标签编码或名称" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'print:label:create'" @click="openCreate">新增标签</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="labels" row-key="id">
        <el-table-column prop="labelCode" label="标签编码" width="150" />
        <el-table-column prop="labelName" label="标签名称" min-width="160" />
        <el-table-column prop="barcodeType" label="条码类型" width="120" />
        <el-table-column prop="paperSize" label="纸张规格" width="120" />
        <el-table-column prop="version" label="版本" width="80" />
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="dialogVisible" title="新增标签模板" width="480px">
      <el-form label-width="100px">
        <el-form-item label="标签编码"><el-input v-model="form.labelCode" /></el-form-item>
        <el-form-item label="标签名称"><el-input v-model="form.labelName" /></el-form-item>
        <el-form-item label="条码类型">
          <el-select v-model="form.barcodeType">
            <el-option label="CODE128" value="CODE128" />
            <el-option label="EAN13" value="EAN13" />
            <el-option label="QR" value="QR" />
          </el-select>
        </el-form-item>
        <el-form-item label="纸张规格">
          <el-select v-model="form.paperSize">
            <el-option label="50x30" value="50x30" />
            <el-option label="70x50" value="70x50" />
            <el-option label="100x80" value="100x80" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
