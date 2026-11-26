<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="full-page-center">
    <el-result icon="warning" title="403" sub-title="无权限访问该页面">
      <template #extra>
        <el-button type="primary" @click="router.replace('/dashboard')">返回工作台</el-button>
      </template>
    </el-result>
  </div>
</template>
