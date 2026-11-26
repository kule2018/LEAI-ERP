<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { completeWave, fetchWaveDetail, fetchWaves, pickTask, type PickTask, type PickWave } from '@/api/inventory'

const waves = ref<PickWave[]>([])
const tasks = ref<PickTask[]>([])
const currentWaveId = ref(0)
const loading = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchWaves({ page: 1, pageSize: 50 })
    waves.value = result.list
    if (waves.value.length) {
      await selectWave(waves.value[0]?.id ?? 0)
    }
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载波次失败')
  } finally {
    loading.value = false
  }
}

async function selectWave(id: number): Promise<void> {
  if (!id) return
  currentWaveId.value = id
  try {
    const detail = await fetchWaveDetail(id)
    tasks.value = detail.tasks
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载拣货任务失败')
  }
}

async function pick(id: number): Promise<void> {
  try {
    await pickTask(currentWaveId.value, id, '1')
    ElMessage.success('已拣货 1 件')
    await selectWave(currentWaveId.value)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '拣货失败')
  }
}

async function complete(): Promise<void> {
  try {
    await completeWave(currentWaveId.value)
    ElMessage.success('波次已完成')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '完成失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="mobile-page">
    <header class="mobile-header">
      <h2>移动拣货</h2>
      <p>选择波次后逐项拣货，拣货数量实时回写库存任务。</p>
    </header>

    <div class="wave-tabs">
      <el-button
        v-for="wave in waves"
        :key="wave.id"
        size="small"
        :type="wave.id === currentWaveId ? 'primary' : 'default'"
        @click="selectWave(Number(wave.id))"
      >
        {{ wave.waveNo }}
      </el-button>
    </div>

    <article v-for="task in tasks" :key="task.id" class="mobile-card">
      <div class="card-head">
        <strong>产品 #{{ task.productId }}</strong>
        <span class="status">{{ task.status }}</span>
      </div>
      <div class="meta">库位 {{ task.locationId }} ｜ 应拣 {{ task.qty }} ｜ 已拣 {{ task.pickedQty }}</div>
      <el-button size="small" type="primary" class="pick-button" :disabled="task.status === 'DONE'" @click="pick(Number(task.id))">拣 1 件</el-button>
    </article>

    <el-button type="success" class="complete-button" :disabled="!currentWaveId" @click="complete">完成波次</el-button>
  </section>
</template>

<style scoped>
.mobile-page { max-width: 560px; margin: 0 auto; }
.mobile-header { margin-bottom: 16px; }
.mobile-header h2 { margin: 0 0 6px; }
.mobile-header p { margin: 0; color: #646a73; font-size: 13px; }
.wave-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.mobile-card { padding: 16px; margin-bottom: 12px; background: #fff; border-radius: 10px; }
.card-head { display: flex; justify-content: space-between; align-items: center; }
.meta { margin-top: 8px; color: #646a73; font-size: 13px; }
.status { color: #409eff; font-size: 12px; }
.pick-button, .complete-button { min-height: 44px; margin-top: 12px; }
.complete-button { width: 100%; }
</style>
