<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchApiDocs, fetchPermissionCodes, type ApiGroupDoc } from '@/api/docs'

const groups = ref<ApiGroupDoc[]>([])
const permissions = ref<string[]>([])
const loading = ref(false)
const keyword = ref('')

async function load(): Promise<void> {
  loading.value = true
  try {
    const [groupResult, permissionResult] = await Promise.all([fetchApiDocs(), fetchPermissionCodes()])
    groups.value = groupResult
    permissions.value = permissionResult
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载接口文档失败')
  } finally {
    loading.value = false
  }
}

function filteredPermissions(): string[] {
  const value = keyword.value.trim().toLowerCase()
  if (!value) return permissions.value.slice(0, 200)
  return permissions.value.filter((item) => item.toLowerCase().includes(value))
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>接口文档</h2>
      <p>应用内查看核心接口与权限码清单，权限码由后端种子统一维护。</p>
    </header>

    <article v-for="group in groups" :key="group.module" class="panel">
      <h3>{{ group.module }}</h3>
      <p class="description">{{ group.description }}</p>
      <el-table :data="group.endpoints" row-key="path" size="small">
        <el-table-column prop="method" label="方法" width="90" />
        <el-table-column prop="path" label="路径" min-width="300" />
        <el-table-column prop="perm" label="权限码" min-width="220" />
        <el-table-column prop="description" label="说明" min-width="220" />
      </el-table>
    </article>

    <article class="panel">
      <div class="panel-toolbar">
        <h3>权限码清单</h3>
        <el-input v-model="keyword" placeholder="搜索权限码" clearable style="width: 260px" />
      </div>
      <div class="permission-grid">
        <el-tag v-for="item in filteredPermissions()" :key="item" size="small">{{ item }}</el-tag>
      </div>
      <p class="hint">共 {{ permissions.length }} 个权限码，当前最多展示 200 条或使用关键字过滤。</p>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; margin-bottom: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin-top: 0; }
.description { color: #646a73; font-size: 13px; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.permission-grid { display: flex; flex-wrap: wrap; gap: 6px; max-height: 360px; overflow-y: auto; }
.hint { margin-top: 12px; color: #646a73; font-size: 12px; }
</style>
