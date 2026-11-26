<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  cleanupBackups,
  createBackupPolicy,
  createRestore,
  executeBackup,
  fetchBackupPolicies,
  fetchBackupRecords,
  fetchBackupSummary,
  fetchRestoreRecords,
  toggleBackupPolicy,
  updateBackupPolicy,
  type BackupPolicy,
  type BackupRecord,
  type BackupSummary,
  type RestoreRecord
} from '@/api/system-backup'

const policies = ref<BackupPolicy[]>([])
const records = ref<BackupRecord[]>([])
const restores = ref<RestoreRecord[]>([])
const summary = ref<BackupSummary | null>(null)
const loading = ref(false)
const recordLoading = ref(false)
const policyDialogVisible = ref(false)
const policyForm = reactive({
  id: 0,
  policyCode: '',
  policyName: '',
  backupType: 'FULL',
  intervalMinutes: 1440,
  retentionDays: 30,
  storagePath: 'backups',
  remotePath: '',
  remoteEnabled: false
})

const riskLabel: Record<string, string> = { HEALTHY: '正常', WARNING: '预警', CRITICAL: '严重' }

async function loadPolicies(): Promise<void> {
  policies.value = await fetchBackupPolicies()
}

async function loadRecords(): Promise<void> {
  recordLoading.value = true
  try {
    const result = await fetchBackupRecords({ page: 1, pageSize: 50 })
    records.value = result.list ?? []
  } finally {
    recordLoading.value = false
  }
}

async function loadRestores(): Promise<void> {
  const result = await fetchRestoreRecords()
  restores.value = result.list ?? []
}

async function loadSummary(): Promise<void> {
  summary.value = await fetchBackupSummary()
}

async function load(): Promise<void> {
  loading.value = true
  try {
    await Promise.all([loadPolicies(), loadRecords(), loadRestores(), loadSummary()])
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载备份数据失败')
  } finally {
    loading.value = false
  }
}

function openPolicyDialog(policy?: BackupPolicy): void {
  if (policy) {
    Object.assign(policyForm, {
      id: policy.id,
      policyCode: policy.policyCode,
      policyName: policy.policyName,
      backupType: policy.backupType,
      intervalMinutes: policy.intervalMinutes,
      retentionDays: policy.retentionDays,
      storagePath: policy.storagePath,
      remotePath: policy.remotePath ?? '',
      remoteEnabled: policy.remoteEnabled === 1
    })
  } else {
    Object.assign(policyForm, {
      id: 0,
      policyCode: '',
      policyName: '',
      backupType: 'FULL',
      intervalMinutes: 1440,
      retentionDays: 30,
      storagePath: 'backups',
      remotePath: '',
      remoteEnabled: false
    })
  }
  policyDialogVisible.value = true
}

async function submitPolicy(): Promise<void> {
  try {
    const payload = {
      policyName: policyForm.policyName,
      backupType: policyForm.backupType,
      intervalMinutes: policyForm.intervalMinutes,
      retentionDays: policyForm.retentionDays,
      storagePath: policyForm.storagePath,
      remotePath: policyForm.remotePath || undefined,
      remoteEnabled: policyForm.remoteEnabled
    }
    if (policyForm.id) await updateBackupPolicy(policyForm.id, payload)
    else await createBackupPolicy({ ...payload, policyCode: policyForm.policyCode })
    ElMessage.success(policyForm.id ? '策略已更新' : '策略已创建')
    policyDialogVisible.value = false
    await Promise.all([loadPolicies(), loadSummary()])
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存策略失败')
  }
}

async function handleToggle(policy: BackupPolicy): Promise<void> {
  try {
    await toggleBackupPolicy(policy.id)
    ElMessage.success('策略状态已切换')
    await loadPolicies()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
  }
}

async function handleExecute(policy?: BackupPolicy): Promise<void> {
  try {
    await executeBackup(policy ? { policyId: policy.id } : {})
    ElMessage.success('备份执行完成')
    await Promise.all([loadRecords(), loadSummary(), loadPolicies()])
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '备份执行失败')
  }
}

async function handleRestore(record: BackupRecord): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt('请填写恢复说明（演练模式不会写入数据库）', `恢复 ${record.backupNo}`, {
      inputPlaceholder: '如：季度恢复演练'
    })
    await createRestore({ backupId: record.id, restoreMode: 'DRY_RUN', operatorNote: value })
    ElMessage.success('恢复演练已完成')
    await loadRestores()
  } catch (cause) {
    if (cause === 'cancel' || cause === 'close') return
    ElMessage.error(cause instanceof Error ? cause.message : '恢复失败')
  }
}

async function handleCleanup(): Promise<void> {
  try {
    await ElMessageBox.confirm('将按保留期删除过期备份文件与记录，确认继续？', '清理过期备份', { type: 'warning' })
    const result = await cleanupBackups()
    ElMessage.success(`已清理 ${result.removed} 条记录、${result.removedFiles} 个文件`)
    await Promise.all([loadRecords(), loadSummary()])
  } catch (cause) {
    if (cause === 'cancel' || cause === 'close') return
    ElMessage.error(cause instanceof Error ? cause.message : '清理失败')
  }
}

onMounted(load)
</script>
<template>
  <section class="page-container">
    <header class="page-header">
      <h2>备份与恢复</h2>
      <p>配置数据库备份策略（全量/增量、间隔、保留天数、异地存储），查看执行记录，并按需进行恢复演练。</p>
    </header>

    <div class="metric-grid">
      <article class="metric-card"><span>最近备份</span><strong>{{ summary?.latestBackupAt ?? '未备份' }}</strong></article>
      <article class="metric-card"><span>覆盖时长</span><strong>{{ summary?.coverageHours ?? 0 }} 小时</strong></article>
      <article class="metric-card"><span>成功 / 失败</span><strong>{{ summary?.successCount ?? 0 }} / {{ summary?.failedCount ?? 0 }}</strong></article>
      <article class="metric-card"><span>风险等级</span><strong>{{ riskLabel[summary?.riskLevel ?? 'HEALTHY'] ?? '-' }}</strong></article>
      <article class="metric-card"><span>策略（启用）</span><strong>{{ summary?.enabledPolicyCount ?? 0 }} / {{ summary?.policyCount ?? 0 }}</strong></article>
      <article class="metric-card"><span>备份总量</span><strong>{{ Math.round((summary?.totalSize ?? 0) / 1024 / 1024) }} MB</strong></article>
    </div>

    <el-tabs class="panel">
      <el-tab-pane label="备份策略">
        <div class="panel-toolbar">
          <el-button type="primary" v-perm="'system:backup:manage'" @click="openPolicyDialog()">新增策略</el-button>
          <el-button type="warning" v-perm="'system:backup:execute'" @click="handleExecute()">立即备份</el-button>
        </div>
        <el-table :data="policies" v-loading="loading" border>
          <el-table-column prop="policyCode" label="策略编码" width="150" />
          <el-table-column prop="policyName" label="策略名称" min-width="160" />
          <el-table-column prop="backupType" label="类型" width="110">
            <template #default="{ row }">{{ row.backupType === 'INCREMENTAL' ? '增量' : '全量' }}</template>
          </el-table-column>
          <el-table-column prop="intervalMinutes" label="间隔(分钟)" width="120" />
          <el-table-column prop="retentionDays" label="保留天数" width="110" />
          <el-table-column prop="storagePath" label="存储目录" min-width="200" />
          <el-table-column label="异地" width="90">
            <template #default="{ row }">{{ row.remoteEnabled === 1 ? '已开启' : '未开启' }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="lastResult" label="最近结果" min-width="200" />
          <el-table-column label="操作" width="220">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'system:backup:manage'" @click="openPolicyDialog(row)">编辑</el-button>
              <el-button link type="warning" v-perm="'system:backup:manage'" @click="handleToggle(row)">
                {{ row.status === 'ENABLED' ? '停用' : '启用' }}
              </el-button>
              <el-button link type="success" v-perm="'system:backup:execute'" @click="handleExecute(row)">执行</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="执行记录">
        <div class="panel-toolbar">
          <el-button v-perm="'system:backup:manage'" @click="handleCleanup">清理过期备份</el-button>
        </div>
        <el-table :data="records" v-loading="recordLoading" border>
          <el-table-column prop="backupNo" label="备份编号" width="190" />
          <el-table-column prop="policyCode" label="策略" width="130" />
          <el-table-column label="类型" width="90">
            <template #default="{ row }">{{ row.backupType === 'INCREMENTAL' ? '增量' : '全量' }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="fileName" label="备份文件" min-width="220" />
          <el-table-column label="大小(MB)" width="110">
            <template #default="{ row }">{{ Math.round(row.fileSize / 1024 / 1024 * 100) / 100 }}</template>
          </el-table-column>
          <el-table-column label="耗时(ms)" width="110">
            <template #default="{ row }">{{ row.durationMs }}</template>
          </el-table-column>
          <el-table-column label="异地" width="90">
            <template #default="{ row }">{{ row.isOffsite === 1 ? '已归档' : '-' }}</template>
          </el-table-column>
          <el-table-column prop="finishedAt" label="完成时间" width="170" />
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button link type="danger" :disabled="row.status !== 'SUCCESS'" v-perm="'system:backup:restore'" @click="handleRestore(row)">恢复演练</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="恢复台账">
        <el-table :data="restores" border>
          <el-table-column prop="restoreNo" label="恢复单号" width="190" />
          <el-table-column prop="backupNo" label="备份编号" width="190" />
          <el-table-column label="模式" width="110">
            <template #default="{ row }">{{ row.restoreMode === 'FULL' ? '真实恢复' : '恢复演练' }}</template>
          </el-table-column>
          <el-table-column prop="targetEnv" label="目标环境" width="120" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="resultMessage" label="结果" min-width="260" />
          <el-table-column prop="finishedAt" label="完成时间" width="170" />
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="policyDialogVisible" :title="policyForm.id ? '编辑备份策略' : '新增备份策略'" width="560px">
      <el-form label-width="110px">
        <el-form-item v-if="!policyForm.id" label="策略编码">
          <el-input v-model="policyForm.policyCode" placeholder="如：daily-full" />
        </el-form-item>
        <el-form-item label="策略名称">
          <el-input v-model="policyForm.policyName" placeholder="如：每日全量备份" />
        </el-form-item>
        <el-form-item label="备份类型">
          <el-select v-model="policyForm.backupType" style="width: 100%">
            <el-option label="全量备份" value="FULL" />
            <el-option label="增量备份（需开启 binlog）" value="INCREMENTAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="执行间隔">
          <el-input-number v-model="policyForm.intervalMinutes" :min="5" :step="60" style="width: 100%" />
        </el-form-item>
        <el-form-item label="保留天数">
          <el-input-number v-model="policyForm.retentionDays" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="存储目录">
          <el-input v-model="policyForm.storagePath" placeholder="backups" />
        </el-form-item>
        <el-form-item label="异地目录">
          <el-input v-model="policyForm.remotePath" placeholder="选填，如 /data/offsite" />
        </el-form-item>
        <el-form-item label="异地归档">
          <el-switch v-model="policyForm.remoteEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="policyDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPolicy">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>