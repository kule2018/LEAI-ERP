import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import { perm } from './directives/perm'
import i18n from './locales'
import { flushOfflineQueue, watchOfflineQueue } from './utils/http'
import './styles/index.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(ElementPlus, { locale: zhCn })
app.directive('perm', perm)
app.mount('#app')

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}

// 离线暂存队列：网络恢复后按原幂等键自动重放
watchOfflineQueue()
void flushOfflineQueue()
