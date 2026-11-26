<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createEquipment, fetchEquipment, type Equipment, type ManufacturingQuery } from '@/api/manufacturing'

const rows = ref<Equipment[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<ManufacturingQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ equipmentCode: '', equipmentName: '', workCenterId: 0, oee: '0', lastMaintenance: '' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchEquipment(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { equipmentCode: '', equipmentName: '', workCenterId: 0, oee: '0', lastMaintenance: '' }); visible.value = true }
async function save(): Promise<void> {
  try {
    await createEquipment({ ...form, workCenterId: form.workCenterId || undefined, lastMaintenance: form.lastMaintenance || undefined })
    visible.value = false
    ElMessage.success('设备已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>设备</h2><p>设备台账、工作中心归属、OEE 和保养记录。</p></header>
    <article class="panel">
      <div class="toolbar"><el-button type="primary" v-perm="'mfg:equipment:create'" @click="openAdd">新增设备</el-button><el-button @click="load">刷新</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="equipmentCode" label="设备编码" width="150" />
        <el-table-column prop="equipmentName" label="设备名称" min-width="160" />
        <el-table-column prop="workCenterId" label="工作中心" width="120" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="oee" label="OEE" width="100" />
        <el-table-column prop="lastMaintenance" label="上次保养" width="130" />
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
    <el-dialog v-model="visible" title="新增设备" width="520px">
      <el-form label-width="100px">
        <el-form-item label="设备编码"><el-input v-model="form.equipmentCode" /></el-form-item>
        <el-form-item label="设备名称"><el-input v-model="form.equipmentName" /></el-form-item>
        <el-form-item label="工作中心ID"><el-input-number v-model="form.workCenterId" :min="0" /></el-form-item>
        <el-form-item label="OEE"><el-input v-model="form.oee" /></el-form-item>
        <el-form-item label="上次保养"><el-date-picker v-model="form.lastMaintenance" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
