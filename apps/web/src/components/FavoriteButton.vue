<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchFavorites, toggleFavorite } from '@/api/user-preference'

const props = withDefaults(
  defineProps<{
    targetType?: string
    targetKey: string
    title: string
    route?: string
    bizType?: string
    bizId?: number
  }>(),
  { targetType: 'PAGE' }
)

const emit = defineEmits<{
  change: [favorited: boolean]
}>()

const favorited = ref(false)

onMounted(async () => {
  try {
    const list = await fetchFavorites({ targetType: props.targetType })
    favorited.value = list.some((item) => item.targetKey === props.targetKey)
  } catch {
    favorited.value = false
  }
})

async function handleToggle(): Promise<void> {
  try {
    const result = await toggleFavorite({
      targetType: props.targetType,
      targetKey: props.targetKey,
      title: props.title,
      route: props.route,
      bizType: props.bizType,
      bizId: props.bizId
    })
    favorited.value = result.favorited
    emit('change', result.favorited)
    ElMessage.success(result.favorited ? '已收藏' : '已取消收藏')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
  }
}
</script>

<template>
  <el-button link :type="favorited ? 'warning' : 'primary'" @click.stop="handleToggle">
    {{ favorited ? '已收藏' : '收藏' }}
  </el-button>
</template>
