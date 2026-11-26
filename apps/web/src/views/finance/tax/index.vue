<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  buildTaxDeclaration, calcTax, createCategory, createTaxCode, fetchCategories, fetchTaxCodes,
  type Category, type TaxCode, type TaxDeclaration
} from '@/api/finance-tax'

const tab = ref('declare')
const codes = ref<TaxCode[]>([])
const categories = ref<Category[]>([])
const declaration = ref<TaxDeclaration | null>(null)
const period = ref(new Date().toISOString().slice(0, 7))
const calcForm = reactive({ amount: 1000, rate: 0.13, inclusive: false })
const calcResult = ref<{ netAmount: number; taxAmount: number; grossAmount: number } | null>(null)
const codeForm = reactive({ taxCode: '', taxName: '', taxType: 'VAT', rate: '0.13', direction: 'BOTH' })
const categoryForm = reactive({ categoryType: 'EXPENSE', categoryCode: '', categoryName: '', parentCode: '' })

async function load(): Promise<void> {
  codes.value = await fetchTaxCodes()
  categories.value = await fetchCategories()
}

async function doCalc(): Promise<void> {
  calcResult.value = await calcTax({ amount: calcForm.amount, rate: calcForm.rate, inclusive: calcForm.inclusive })
}

async function doBuild(declare: boolean): Promise<void> {
  declaration.value = await buildTaxDeclaration({ period: period.value, declare })
  ElMessage.success(declare ? '申报已提交' : '申报汇总已生成')
}

async function addCode(): Promise<void> {
  await createTaxCode(codeForm)
  ElMessage.success('税码已创建')
  await load()
}

async function addCategory(): Promise<void> {
  await createCategory({ ...categoryForm, parentCode: categoryForm.parentCode || undefined })
  ElMessage.success('类别已创建')
  await load()
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>税务申报与类别主数据</h2>
      <p>维护税码税率和费用/收入类别，按期间汇总销项/进项税额并生成申报表。</p>
    </header>
    <el-tabs v-model="tab" type="card">
      <el-tab-pane label="税务申报" name="declare">
        <article class="panel form-panel">
          <el-form :inline="true">
            <el-form-item label="申报期间"><el-date-picker v-model="period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  /></el-form-item>
            <el-form-item>
              <el-button type="primary" v-perm="'finance:invoice:view'" @click="doBuild(false)">生成汇总</el-button>
              <el-button type="warning" v-perm="'finance:invoice:create'" @click="doBuild(true)">提交申报</el-button>
            </el-form-item>
          </el-form>
          <el-descriptions v-if="declaration" :column="3" border>
            <el-descriptions-item label="申报单号">{{ declaration.declarationNo }}</el-descriptions-item>
            <el-descriptions-item label="销项税额">{{ declaration.totalOutputTax }}</el-descriptions-item>
            <el-descriptions-item label="进项税额">{{ declaration.totalInputTax }}</el-descriptions-item>
            <el-descriptions-item label="应纳税额">{{ declaration.taxPayable }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ declaration.status }}</el-descriptions-item>
          </el-descriptions>
          <el-table v-if="declaration" :data="declaration.details ?? []" size="small" style="margin-top: 12px">
            <el-table-column prop="taxCode" label="税码" width="120" />
            <el-table-column prop="taxName" label="税名" min-width="160" />
            <el-table-column prop="outputTax" label="销项" width="120" />
            <el-table-column prop="inputTax" label="进项" width="120" />
            <el-table-column prop="netTax" label="应纳税" width="120" />
          </el-table>
        </article>
        <article class="panel form-panel">
          <h3>价税分离试算</h3>
          <el-form :inline="true">
            <el-form-item label="金额"><el-input-number v-model="calcForm.amount" :min="0" /></el-form-item>
            <el-form-item label="税率"><el-input-number v-model="calcForm.rate" :min="0" :max="1" :step="0.01" /></el-form-item>
            <el-form-item label="含税"><el-switch v-model="calcForm.inclusive" /></el-form-item>
            <el-form-item><el-button @click="doCalc">试算</el-button></el-form-item>
          </el-form>
          <el-descriptions v-if="calcResult" :column="3" border>
            <el-descriptions-item label="不含税">{{ calcResult.netAmount }}</el-descriptions-item>
            <el-descriptions-item label="税额">{{ calcResult.taxAmount }}</el-descriptions-item>
            <el-descriptions-item label="价税合计">{{ calcResult.grossAmount }}</el-descriptions-item>
          </el-descriptions>
        </article>
      </el-tab-pane>
      <el-tab-pane label="税码税率" name="codes">
        <article class="panel form-panel">
          <el-form :inline="true">
            <el-form-item label="税码"><el-input v-model="codeForm.taxCode" /></el-form-item>
            <el-form-item label="名称"><el-input v-model="codeForm.taxName" /></el-form-item>
            <el-form-item label="税种">
              <el-select v-model="codeForm.taxType" style="width: 120px">
                <el-option label="增值税" value="VAT" />
                <el-option label="企业所得税" value="CIT" />
                <el-option label="附加税" value="SURTAX" />
                <el-option label="印花税" value="STAMP" />
              </el-select>
            </el-form-item>
            <el-form-item label="税率"><el-input v-model="codeForm.rate" /></el-form-item>
            <el-form-item label="方向">
              <el-select v-model="codeForm.direction" style="width: 110px">
                <el-option label="销项" value="OUTPUT" />
                <el-option label="进项" value="INPUT" />
                <el-option label="双向" value="BOTH" />
              </el-select>
            </el-form-item>
            <el-form-item><el-button type="primary" v-perm="'finance:invoice:create'" @click="addCode">新增</el-button></el-form-item>
          </el-form>
        </article>
        <article class="panel">
          <el-table :data="codes" size="small">
            <el-table-column prop="taxCode" label="税码" width="120" />
            <el-table-column prop="taxName" label="名称" min-width="160" />
            <el-table-column prop="taxType" label="税种" width="110" />
            <el-table-column prop="rate" label="税率" width="120" />
            <el-table-column prop="direction" label="方向" width="100" />
            <el-table-column prop="status" label="状态" width="100" />
          </el-table>
        </article>
      </el-tab-pane>
      <el-tab-pane label="费用/收入类别" name="categories">
        <article class="panel form-panel">
          <el-form :inline="true">
            <el-form-item label="类别类型">
              <el-select v-model="categoryForm.categoryType" style="width: 120px">
                <el-option label="费用" value="EXPENSE" />
                <el-option label="收入" value="REVENUE" />
              </el-select>
            </el-form-item>
            <el-form-item label="编码"><el-input v-model="categoryForm.categoryCode" /></el-form-item>
            <el-form-item label="名称"><el-input v-model="categoryForm.categoryName" /></el-form-item>
            <el-form-item label="父级"><el-input v-model="categoryForm.parentCode" /></el-form-item>
            <el-form-item><el-button type="primary" v-perm="'finance:expense:create'" @click="addCategory">新增</el-button></el-form-item>
          </el-form>
        </article>
        <article class="panel">
          <el-table :data="categories" size="small">
            <el-table-column prop="categoryType" label="类型" width="110" />
            <el-table-column prop="categoryCode" label="编码" width="130" />
            <el-table-column prop="categoryName" label="名称" min-width="160" />
            <el-table-column prop="parentCode" label="父级" width="120" />
            <el-table-column prop="status" label="状态" width="100" />
          </el-table>
        </article>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.form-panel { max-width: 960px; }
</style>
