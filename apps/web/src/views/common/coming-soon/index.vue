<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>{{ String(route.meta.title ?? '功能建设') }}</h2>
      <p>该页面已注册路由，将在对应阶段生成完整业务功能。</p>
    </header>
    <el-empty description="功能建设中" />
  </section>
</template>
