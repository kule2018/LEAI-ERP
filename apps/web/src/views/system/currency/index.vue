<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { convertCurrency, fetchRates, setRate, type ExchangeRate } from '@/api/currency'

const rows = ref<ExchangeRate[]>([])
const loading = ref(false)
const fav = reactive({ amount: 100, from: 'USD', to: 'CNY', date: new Date().toISOString().slice(0, 10) })
const converted = ref<number | null>(null)
const form = reactive({ fromCurrency: 'USD', toCurrency: 'CNY', rate: 7.2, effectiveDate: new Date().toISOString().slice(0, 10), reason: '' })

async function load(): Promise<void> {
  loading.value = true
  try { rows.value = await fetchRates() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载汇率失败') }
  finally { loading.value = false }
}

async function save(): Promise<void> {
  try {
    await setRate({ ...form, rate: Number(form.rate) })
    ElMessage.success('汇率已保存')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}

async function convert(): Promise<void> {
  try {
    const result = await convertCurrency({ amount: Number(fav.amount), from: fav.from, to: fav.to, date: fav.date })
    converted.value = result.converted
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '换算失败') }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>汇率管理</h2><p>维护币种汇率、按生效日期换算；变动超过 5% 需填写变更原因并留审计。</p></header>
    <article class="panel">
      <h3>新增 / 更新汇率</h3>
      <el-form :model="form" label-width="110px" class="form">
        <el-form-item label="源币种"><el-input v-model="form.fromCurrency" maxlength="3" /></el-form-item>
        <el-form-item label="目标币种"><el-input v-model="form.toCurrency" maxlength="3" /></el-form-item>
        <el-form-item label="汇率"><el-input-number v-model="form.rate" :min="0.000001" :precision="6" /></el-form-item>
        <el-form-item label="生效日期"><el-date-picker v-model="form.effectiveDate" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="变更原因"><el-input v-model="form.reason" placeholder="变动超 5% 时必填" /></el-form-item>
        <el-form-item><el-button type="primary" v-perm="'system:currency:update'" @click="save">保存</el-button></el-form-item>
      </el-form>
    </article>
    <article class="panel">
      <h3>汇率换算</h3>
      <div class="toolbar">
        <el-input-number v-model="fav.amount" :min="0" :precision="2" style="width: 160px" />
        <el-input v-model="fav.from" maxlength="3" style="width: 90px" />
        <span>→</span>
        <el-input v-model="fav.to" maxlength="3" style="width: 90px" />
        <el-date-picker v-model="fav.date" type="date" value-format="YYYY-MM-DD" style="width: 160px" />
        <el-button @click="convert">换算</el-button>
        <el-tag v-if="converted !== null" type="success">结果：{{ converted }}</el-tag>
      </div>
    </article>
    <article class="panel">
      <h3>汇率列表</h3>
      <el-table :data="rows" v-loading="loading" size="small" max-height="360">
        <el-table-column prop="fromCurrency" label="源币种" width="90" />
        <el-table-column prop="toCurrency" label="目标币种" width="100" />
        <el-table-column prop="rate" label="汇率" width="140" />
        <el-table-column prop="effectiveDate" label="生效日期" width="130" />
        <el-table-column prop="source" label="来源" />
      </el-table>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.form { max-width: 520px; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
</style>
