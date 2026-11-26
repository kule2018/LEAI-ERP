<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchExpiringContracts, renewContract, signContract, type SaleContract } from '@/api/sales'

const rows = ref<SaleContract[]>([])
const loading = ref(false)
const error = ref('')
const renewVisible = ref(false)
const signVisible = ref(false)
const submitting = ref(false)
const current = ref<SaleContract | null>(null)
const renewForm = ref<{ title: string; termMonths: number; startDate: string; endDate: string; totalAmount: string }>({
  title: '', termMonths: 12, startDate: '', endDate: '', totalAmount: ''
})
const signForm = ref({ esignNo: '' })
let requestSeq = 0

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchExpiringContracts()
    if (seq !== requestSeq) return
    rows.value = result
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function openRenew(row: SaleContract): void {
  current.value = row
  renewForm.value = {
    title: `${row.title}（续签）`,
    termMonths: 12,
    startDate: row.endDate ?? '',
    endDate: '',
    totalAmount: row.totalAmount
  }
  renewVisible.value = true
}

function openSign(row: SaleContract): void {
  current.value = row
  signForm.value = { esignNo: row.esignNo ?? '' }
  signVisible.value = true
}

async function submitRenew(): Promise<void> {
  if (!current.value || submitting.value) return
  submitting.value = true
  try {
    await renewContract(current.value.id, {
      title: renewForm.value.title || undefined,
      termMonths: renewForm.value.termMonths,
      startDate: renewForm.value.startDate || undefined,
      endDate: renewForm.value.endDate || undefined,
      totalAmount: renewForm.value.totalAmount || undefined
    })
    renewVisible.value = false
    ElMessage.success('合同已续签')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '续签失败')
  } finally {
    submitting.value = false
  }
}

async function submitSign(): Promise<void> {
  if (!current.value || submitting.value) return
  if (!signForm.value.esignNo.trim()) {
    ElMessage.warning('请填写电子签署单号')
    return
  }
  submitting.value = true
  try {
    await signContract(current.value.id, { esignNo: signForm.value.esignNo.trim() })
    signVisible.value = false
    ElMessage.success('签署信息已登记')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '登记失败')
  } finally {
    submitting.value = false
  }
}

onMounted(load)
onUnmounted(() => { requestSeq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>合同履约</h2>
      <p>临期合同提醒、合同续签与电子签署登记。</p>
    </header>

    <article class="panel">
      <div class="toolbar">
        <el-button @click="load">刷新</el-button>
      </div>
      <div v-if="error" class="error-banner">{{ error }}</div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="contractNo" label="合同编号" width="160" />
        <el-table-column prop="title" label="合同标题" min-width="200" />
        <el-table-column prop="customerId" label="客户ID" width="100" />
        <el-table-column prop="endDate" label="到期日" width="130" />
        <el-table-column prop="totalAmount" label="合同金额" width="130" />
        <el-table-column prop="renewCount" label="续签次数" width="100" />
        <el-table-column prop="esignNo" label="电子签署单号" width="160">
          <template #default="{ row }">{{ row.esignNo || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'sales:contract:renew'" @click="openRenew(row)">续签</el-button>
            <el-button link type="success" v-perm="'sales:contract:sign'" @click="openSign(row)">签署</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>

    <el-dialog v-model="renewVisible" title="合同续签" width="520px">
      <el-form label-width="110px">
        <el-form-item label="续签标题"><el-input v-model="renewForm.title" /></el-form-item>
        <el-form-item label="续签期数(月)"><el-input-number v-model="renewForm.termMonths" :min="1" :max="120" /></el-form-item>
        <el-form-item label="新起始日"><el-date-picker v-model="renewForm.startDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="新到期日"><el-input v-model="renewForm.endDate" placeholder="留空按期数自动推算" /></el-form-item>
        <el-form-item label="合同金额"><el-input v-model="renewForm.totalAmount" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="renewVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitRenew">确认续签</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="signVisible" title="电子签署登记" width="480px">
      <el-form label-width="110px">
        <el-form-item label="签署单号"><el-input v-model="signForm.esignNo" placeholder="第三方电子签平台单号" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="signVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitSign">登记</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.error-banner { margin-bottom: 16px; padding: 12px 16px; color: #f5222d; background: #fff1f0; border-radius: 8px; }
</style>
