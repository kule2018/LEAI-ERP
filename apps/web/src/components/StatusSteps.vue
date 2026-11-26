<script setup lang="ts">
import { computed } from 'vue'
import type { BizStatus } from '@/types/contract'

const props = defineProps<{ status: BizStatus }>()

const statuses: BizStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIAL', 'DONE']
const active = computed(() => Math.max(0, statuses.indexOf(props.status)))
</script>

<template>
  <div class="status-steps">
    <el-steps :active="active" align-center finish-status="success">
      <el-step v-for="item in statuses" :key="item" :title="item" />
    </el-steps>
    <el-tag v-if="props.status === 'CANCELLED'" type="info" class="cancel-tag">已作废</el-tag>
  </div>
</template>

<style scoped>
.status-steps {
  margin-bottom: var(--erp-space-4);
  padding: var(--erp-space-4);
  background: #fff;
  border-radius: var(--erp-radius-base);
}

.cancel-tag {
  margin-top: var(--erp-space-3);
}
</style>
