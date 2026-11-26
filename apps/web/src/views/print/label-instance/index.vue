<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  batchGenerateLabels,
  createBarcodeRule,
  fetchBarcodeRules,
  fetchLabelInstances,
  printLabelInstance,
  type BarcodeRule,
  type LabelInstance
} from '@/api/ops-enhancement'

const instances = ref<LabelInstance[]>([])
const rules = ref<BarcodeRule[]>([])
const total = ref(0)
const loading = ref(false)
const query = reactive({ page: 1, pageSize: 20, productId: undefined as number | undefined, status: '' })
const generateForm = reactive({
  labelTemplateId: 0,
  productId: 0,
  variantId: 0,
  batchNo: '',
  count: 10,
  ruleCode: ''
})
const ruleForm = reactive({ ruleCode: '', prefix: '', dateFormat: 'yyyyMMdd', seqLength: 6, resetCycle: 'DAILY', barcodeType: 'CODE128' })

function fail(cause: unknown): void {
  ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
}

async function loadInstances(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchLabelInstances({
      page: query.page,
      pageSize: query.pageSize,
      productId: query.productId,
      status: query.status || undefined
    })
    instances.value = result.list
    total.value = result.total
  } catch (cause) {
    fail(cause)
  } finally {
    loading.value = false
  }
}

async function loadRules(): Promise<void> {
  try {
    rules.value = await fetchBarcodeRules()
  } catch (cause) {
    fail(cause)
  }
}

async function handleGenerate(): Promise<void> {
  try {
    const rows = await batchGenerateLabels({
      labelTemplateId: generateForm.labelTemplateId,
      productId: generateForm.productId,
      variantId: generateForm.variantId || undefined,
      batchNo: generateForm.batchNo || undefined,
      count: generateForm.count,
      ruleCode: generateForm.ruleCode || undefined
    })
    ElMessage.success(`已生成 ${rows.length} 个标签序列号`)
    await loadInstances()
  } catch (cause) {
    fail(cause)
  }
}

async function handlePrint(row: LabelInstance): Promise<void> {
  try {
    const result = await printLabelInstance(row.id)
    if (result.warning) {
      ElMessage.warning(result.warning)
    } else {
      ElMessage.success(`标签 ${row.serialNo} 已打印`)
    }
    await loadInstances()
  } catch (cause) {
    fail(cause)
  }
}

async function handleCreateRule(): Promise<void> {
  try {
    await createBarcodeRule({ ...ruleForm })
    ElMessage.success('编码规则已保存')
    await loadRules()
  } catch (cause) {
    fail(cause)
  }
}

onMounted(() => {
  void loadInstances()
  void loadRules()
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>条码标签与序列号</h2>
      <p>按编码规则批量生成唯一序列号标签；重复打印会给出提示并计入打印次数。</p>
    </header>

    <el-tabs>
      <el-tab-pane label="批量生成" name="generate">
        <el-form :inline="true">
          <el-form-item label="标签模板ID">
            <el-input-number v-model="generateForm.labelTemplateId" :min="1" />
          </el-form-item>
          <el-form-item label="产品ID">
            <el-input-number v-model="generateForm.productId" :min="1" />
          </el-form-item>
          <el-form-item label="变体ID">
            <el-input-number v-model="generateForm.variantId" :min="0" />
          </el-form-item>
          <el-form-item label="批次号">
            <el-input v-model="generateForm.batchNo" style="width: 140px" />
          </el-form-item>
          <el-form-item label="数量">
            <el-input-number v-model="generateForm.count" :min="1" :max="500" />
          </el-form-item>
          <el-form-item label="编码规则">
            <el-select v-model="generateForm.ruleCode" clearable style="width: 160px">
              <el-option v-for="rule in rules" :key="rule.id" :label="rule.ruleCode" :value="rule.ruleCode" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleGenerate">生成序列号</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="编码规则" name="rule">
        <el-form :inline="true">
          <el-form-item label="规则编码">
            <el-input v-model="ruleForm.ruleCode" style="width: 140px" />
          </el-form-item>
          <el-form-item label="前缀">
            <el-input v-model="ruleForm.prefix" style="width: 120px" />
          </el-form-item>
          <el-form-item label="日期格式">
            <el-input v-model="ruleForm.dateFormat" style="width: 120px" />
          </el-form-item>
          <el-form-item label="流水位数">
            <el-input-number v-model="ruleForm.seqLength" :min="1" :max="12" />
          </el-form-item>
          <el-form-item label="重置周期">
            <el-select v-model="ruleForm.resetCycle" style="width: 120px">
              <el-option label="不重置" value="NONE" />
              <el-option label="按日" value="DAILY" />
              <el-option label="按月" value="MONTHLY" />
              <el-option label="按年" value="YEARLY" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleCreateRule">保存规则</el-button>
          </el-form-item>
        </el-form>
        <el-table :data="rules" size="small">
          <el-table-column prop="ruleCode" label="规则编码" />
          <el-table-column prop="prefix" label="前缀" />
          <el-table-column prop="dateFormat" label="日期格式" />
          <el-table-column prop="seqLength" label="流水位数" />
          <el-table-column prop="resetCycle" label="重置周期" />
          <el-table-column prop="barcodeType" label="条码类型" />
          <el-table-column prop="status" label="状态" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="标签实例" name="instances">
        <div class="toolbar">
          <el-input-number v-model="query.productId" :min="1" placeholder="产品ID" controls-position="right" style="width: 150px" />
          <el-select v-model="query.status" placeholder="状态" clearable style="width: 140px">
            <el-option label="已生成" value="GENERATED" />
            <el-option label="已打印" value="PRINTED" />
            <el-option label="已作废" value="VOID" />
          </el-select>
          <el-button type="primary" @click="loadInstances">查询</el-button>
        </div>
        <el-table v-loading="loading" :data="instances" row-key="id">
          <el-table-column prop="serialNo" label="序列号" min-width="220" />
          <el-table-column prop="templateCode" label="标签模板" width="140" />
          <el-table-column prop="productId" label="产品ID" width="100" />
          <el-table-column prop="batchNo" label="批次号" width="140" />
          <el-table-column prop="barcodeType" label="条码类型" width="120" />
          <el-table-column prop="printCount" label="打印次数" width="100" />
          <el-table-column prop="lastPrintedAt" label="最近打印" width="170" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column label="操作" width="110">
            <template #default="{ row }">
              <el-button link type="primary" @click="handlePrint(row)">打印</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination">
          <el-pagination
            background
            layout="prev, pager, next"
            :total="total"
            :current-page="query.page"
            :page-size="query.pageSize"
            @current-change="loadInstances"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
