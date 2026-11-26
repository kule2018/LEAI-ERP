<script setup lang="ts">
import type { Component } from 'vue'
import {
  Bell,
  ChatDotRound,
  Collection,
  Connection,
  DataBoard,
  Document,
  Download,
  Folder,
  Lock,
  MagicStick,
  OfficeBuilding,
  Postcard,
  Printer,
  Setting,
  Share,
  Tickets,
  User,
  UserFilled
} from '@element-plus/icons-vue'
import type { MenuItem } from '@/types/contract'

const props = defineProps<{ items: MenuItem[] }>()

const iconMap: Record<string, Component> = {
  DataBoard,
  Setting,
  OfficeBuilding,
  Share,
  Tree: Connection,
  Postcard,
  User,
  UserFilled,
  Lock,
  Collection,
  Tickets,
  Document,
  Download,
  Bell,
  Folder,
  Printer,
  Robot: MagicStick,
  ChatDotRound
}

function visible(items: MenuItem[]): MenuItem[] {
  return (items ?? []).filter((item) => !item.hidden)
}
</script>

<template>
  <template v-for="item in visible(props.items)" :key="item.id">
    <el-sub-menu v-if="visible(item.children ?? []).length > 0" :index="item.path">
      <template #title>
        <el-icon v-if="iconMap[item.icon]"><component :is="iconMap[item.icon]" /></el-icon>
        <span>{{ item.title }}</span>
      </template>
      <MenuItem :items="item.children ?? []" />
    </el-sub-menu>
    <el-menu-item v-else :index="item.path">
      <el-icon v-if="iconMap[item.icon]"><component :is="iconMap[item.icon]" /></el-icon>
      <template #title>{{ item.title }}</template>
    </el-menu-item>
  </template>
</template>
