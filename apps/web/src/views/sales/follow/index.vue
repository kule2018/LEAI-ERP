<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createFollow, fetchFollowTimeline, type Follow } from '@/api/sales'

const rows = ref<Follow[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const query = reactive({
  bizType: '',
  followType: '',
  keyword: '',
  dateRange: [] as string[]
})

const dialogVisible = ref(false)
const saving = ref(false)
const form = reactive({
  bizType: 'lead',
  bizId: 0,
  followType: 'CALL',
  content: '',
  nextTime: ''
})

const BIZ_TYPES = [
  { value: 'lead', label: '线索' },
  { value: 'opportunity', label: '商机' },
  { value: 'customer', label: '客户' }
]

const FOLLOW_TYPES = [
  { value: 'CALL', label: '电话' },
  { value: 'VISIT', label: '拜访' },
  { value: 'EMAIL', label: '邮件' },
  { value: 'WECHAT', label: '微信' },
  { value: 'NOTE', label: '备注' }
]

function bizTypeLabel(value: string): string {
  return BIZ_TYPES.find((item) => item.value === value)?.label ?? value
}

function followTypeLabel(value: string): string {
  return FOLLOW_TYPES.find((item) => item.value === value)?.label ?? value
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchFollowTimeline({
      page: page.value,
      pageSize: pageSize.value,
      bizType: query.bizType || undefined,
      followType: query.followType || undefined,
      keyword: query.keyword || undefined,
      startDate: query.dateRange[0] || undefined,
      endDate: query.dateRange[1] || undefined
    })
    rows.value = result.list
    total.value = result.total
  } finally {
    loading.value = false
  }
}

function handleSearch(): void {
  page.value = 1
  void load()
}

function handleReset(): void {
  query.bizType = ''
  query.followType = ''
  query.keyword = ''
  query.dateRange = []
  page.value = 1
  void load()
}

function openCreate(): void {
  form.bizType = 'lead'
  form.bizId = 0
  form.followType = 'CALL'
  form.content = ''
  form.nextTime = ''
  dialogVisible.value = true
}

async function submit(): Promise<void> {
  if (!form.bizId) {
    ElMessage.warning('请填写关联对象 ID')
    return
  }
  if (!form.content.trim()) {
    ElMessage.warning('请填写跟进内容')
    return
  }
  saving.value = true
  try {
    await createFollow({
      bizType: form.bizType,
      bizId: form.bizId,
      followType: form.followType,
      content: form.content.trim(),
      nextTime: form.nextTime ? new Date(form.nextTime).toISOString() : undefined
    })
    ElMessage.success('跟进记录已保存')
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="follow-page">
    <section class="follow-filter">
      <el-form :inline="true" @submit.prevent="handleSearch">
        <el-form-item label="对象类型">
          <el-select v-model="query.bizType" clearable placeholder="全部" style="width: 140px">
            <el-option v-for="item in BIZ_TYPES" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="跟进方式">
          <el-select v-model="query.followType" clearable placeholder="全部" style="width: 140px">
            <el-option v-for="item in FOLLOW_TYPES" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="跟进内容">
          <el-input v-model="query.keyword" placeholder="关键字" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item label="跟进时间">
          <el-date-picker v-model="query.dateRange" type="daterange" value-format="YYYY-MM-DD" style="width: 240px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="follow-table">
      <div class="follow-toolbar">
        <el-button type="primary" v-perm="'sales:lead:update'" @click="openCreate">新增跟进</el-button>
        <el-button @click="load">刷新</el-button>
      </div>

      <el-table v-loading="loading" :data="rows" border stripe>
        <el-table-column label="对象类型" width="110">
          <template #default="{ row }">{{ bizTypeLabel(row.bizType) }}</template>
        </el-table-column>
        <el-table-column prop="bizId" label="对象 ID" width="100" />
        <el-table-column label="跟进方式" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ followTypeLabel(row.followType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="跟进内容" min-width="260" show-overflow-tooltip />
        <el-table-column label="下次跟进" width="160">
          <template #default="{ row }">{{ row.nextTime ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="createdBy" label="跟进人" width="100" />
        <el-table-column prop="createdAt" label="跟进时间" width="170" />
      </el-table>

      <div class="follow-pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :current-page="page"
          :page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          @current-change="(value: number) => { page = value; load() }"
          @size-change="(value: number) => { pageSize = value; page = 1; load() }"
        />
      </div>
    </section>

    <el-dialog v-model="dialogVisible" title="新增跟进记录" width="520px">
      <el-form label-width="96px">
        <el-form-item label="对象类型">
          <el-select v-model="form.bizType" style="width: 100%">
            <el-option v-for="item in BIZ_TYPES" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="对象 ID">
          <el-input v-model.number="form.bizId" type="number" />
        </el-form-item>
        <el-form-item label="跟进方式">
          <el-select v-model="form.followType" style="width: 100%">
            <el-option v-for="item in FOLLOW_TYPES" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="跟进内容">
          <el-input v-model="form.content" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="下次跟进">
          <el-date-picker v-model="form.nextTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.follow-page {
  display: flex;
  flex-direction: column;
  gap: var(--erp-space-4);
}

.follow-filter,
.follow-table {
  padding: var(--erp-space-4);
  background: #fff;
  border-radius: var(--erp-radius-base);
}

.follow-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--erp-space-2);
  margin-bottom: var(--erp-space-4);
}

.follow-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--erp-space-4);
}
</style>
