<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { portalLogin } from '@/api/supplier-portal'
import { setPortalSession } from '@/utils/portal-http'

const router = useRouter()
const form = reactive({ tenantCode: 'default', username: '', password: '' })
const loading = ref(false)

async function handleSubmit(): Promise<void> {
  if (loading.value) return
  if (!form.username.trim() || !form.password) {
    ElMessage.warning('请输入账号与密码')
    return
  }
  loading.value = true
  try {
    const result = await portalLogin({
      tenantCode: form.tenantCode.trim() || 'default',
      username: form.username.trim(),
      password: form.password
    })
    setPortalSession(result.accessToken, result.profile)
    ElMessage.success(`欢迎，${result.profile.displayName || result.profile.username}`)
    await router.replace('/supplier-portal')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="portal-login">
    <form class="portal-login-card" @submit.prevent="handleSubmit">
      <h1>供应商协同门户</h1>
      <p class="portal-subtitle">使用供应商账号登录，仅可访问本企业的订单、对账与发票</p>

      <label class="portal-field">
        <span>租户编码</span>
        <el-input v-model="form.tenantCode" placeholder="default" />
      </label>

      <label class="portal-field">
        <span>供应商账号</span>
        <el-input v-model="form.username" autocomplete="username" placeholder="请输入账号" />
      </label>

      <label class="portal-field">
        <span>密码</span>
        <el-input
          v-model="form.password"
          type="password"
          autocomplete="current-password"
          show-password
          placeholder="请输入密码"
          @keyup.enter="handleSubmit"
        />
      </label>

      <el-button class="portal-button" type="primary" native-type="submit" :loading="loading">登录门户</el-button>
      <p class="portal-tip">账号由采购管理员在系统内创建与重置，登录失败 5 次将锁定 15 分钟</p>
    </form>
  </div>
</template>

<style scoped>
.portal-login {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #e8f0ff 0%, #f6f8fb 100%);
}

.portal-login-card {
  width: 400px;
  padding: 32px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgb(18 22 31 / 12%);
}

.portal-login-card h1 {
  margin: 0;
  font-size: 24px;
  text-align: center;
}

.portal-subtitle {
  margin: 8px 0 24px;
  color: var(--erp-color-secondary);
  font-size: 13px;
  text-align: center;
}

.portal-field {
  display: block;
  margin-bottom: 16px;
}

.portal-field span {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
}

.portal-button {
  width: 100%;
  height: 42px;
  margin-top: 8px;
}

.portal-tip {
  margin: 16px 0 0;
  color: #8a9099;
  font-size: 12px;
  text-align: center;
}
</style>
