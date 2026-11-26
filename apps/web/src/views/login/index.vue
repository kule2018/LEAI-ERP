<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { changePassword } from '@/api/auth'

const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const form = reactive({
  username: 'admin',
  password: 'Admin@123456',
  tenantCode: 'default'
})
const loading = ref(false)
const pwdVisible = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const pwdLoading = ref(false)

async function handleSubmit(): Promise<void> {
  if (loading.value) {
    return
  }
  loading.value = true
  try {
    await userStore.login({ ...form })
    if (userStore.profile?.mustChangePassword) {
      ElMessage.warning('首次登录，请先修改密码')
      pwdVisible.value = true
      return
    }
    ElMessage.success('登录成功')
    await goAfterLogin()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '登录失败')
  } finally {
    loading.value = false
  }
}

async function goAfterLogin(): Promise<void> {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
  await router.replace(redirect)
}

async function submitPassword(): Promise<void> {
  if (!pwdForm.oldPassword || !pwdForm.newPassword) {
    ElMessage.warning('请填写原密码与新密码')
    return
  }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  pwdLoading.value = true
  try {
    await changePassword({ oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword })
    ElMessage.success('密码已修改，请重新登录')
    pwdVisible.value = false
    await userStore.logout()
    await router.replace('/login')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '修改失败')
  } finally {
    pwdLoading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="handleSubmit">
      <h1>LEAI ERP</h1>
      <p class="login-subtitle">企业一体化管理平台</p>

      <label class="login-field">
        <span>租户编码</span>
        <el-input v-model="form.tenantCode" autocomplete="organization" placeholder="default" />
      </label>

      <label class="login-field">
        <span>登录账号</span>
        <el-input v-model="form.username" autocomplete="username" placeholder="请输入账号" />
      </label>

      <label class="login-field">
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

      <el-button class="login-button" type="primary" native-type="submit" :loading="loading">
        登录
      </el-button>
    </form>

    <el-dialog v-model="pwdVisible" title="修改密码" width="440px" :close-on-click-modal="false">
      <el-form label-width="90px">
        <el-form-item label="原密码">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="至少 8 位，含大小写字母与数字" />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="pwdForm.confirmPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">稍后修改</el-button>
        <el-button type="primary" :loading="pwdLoading" @click="submitPassword">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #eef4ff 0%, #f7f9fc 100%);
}

.login-card {
  width: 420px;
  padding: 32px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgb(18 22 31 / 12%);
}

.login-card h1 {
  margin: 0;
  font-size: 28px;
  line-height: 36px;
  text-align: center;
}

.login-subtitle {
  margin: 8px 0 24px;
  color: var(--erp-color-secondary);
  text-align: center;
}

.login-field {
  display: block;
  margin-bottom: 16px;
}

.login-field span {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
}

.login-button {
  width: 100%;
  height: 44px;
  margin-top: 8px;
}
</style>
