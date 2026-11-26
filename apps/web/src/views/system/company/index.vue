<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createCompany,
  fetchCompanies,
  removeCompany,
  updateCompany,
  type Company
} from '@/api/system-admin'
import type { PageQuery } from '@/types/contract'

const rows = ref<Company[]>([])
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const form = reactive({ id: 0, companyCode: '', companyName: '', creditCode: '', legalPerson: '', status: 'ACTIVE' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchCompanies(query)
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载公司失败')
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, { id: 0, companyCode: '', companyName: '', creditCode: '', legalPerson: '', status: 'ACTIVE' })
  visible.value = true
}

function openEditById(id: number): void {
  const row = rows.value.find((item) => item.id === id)
  if (!row) return
  Object.assign(form, {
    id: row.id,
    companyCode: row.companyCode,
    companyName: row.companyName,
    creditCode: row.creditCode ?? '',
    legalPerson: row.legalPerson ?? '',
    status: row.status
  })
  visible.value = true
}

async function save(): Promise<void> {
  const { id, ...data } = form
  try {
    if (id) await updateCompany(id, data)
    else await createCompany(data)
    visible.value = false
    ElMessage.success('公司已保存')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function removeById(id: number): Promise<void> {
  await ElMessageBox.confirm('确认删除该公司？', '提示', { type: 'warning' })
  try {
    await removeCompany(id)
    ElMessage.success('公司已删除')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '删除失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>公司</h2>
      <p>公司作为组织体系顶层，统一管理多组织架构与租户内主体信息。</p>
    </header>
    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.keyword" placeholder="搜索公司名称" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'system:company:create'" @click="openCreate">新增公司</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table :data="rows" row-key="id" v-loading="loading">
        <el-table-column prop="companyCode" label="公司编码" width="140" />
        <el-table-column prop="companyName" label="公司名称" min-width="180" />
        <el-table-column prop="creditCode" label="统一社会信用代码" min-width="200" />
        <el-table-column prop="legalPerson" label="法人" width="120" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'system:company:update'" @click="openEditById(Number(row.id))">编辑</el-button>
            <el-button link type="danger" v-perm="'system:company:delete'" @click="removeById(Number(row.id))">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="visible" :title="form.id ? '编辑公司' : '新增公司'" width="520px">
      <el-form label-width="120px">
        <el-form-item label="公司编码"><el-input v-model="form.companyCode" :disabled="form.id > 0" /></el-form-item>
        <el-form-item label="公司名称"><el-input v-model="form.companyName" /></el-form-item>
        <el-form-item label="信用代码"><el-input v-model="form.creditCode" /></el-form-item>
        <el-form-item label="法人"><el-input v-model="form.legalPerson" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
