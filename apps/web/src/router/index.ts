import type { Component } from 'vue'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import { useUserStore } from '@/stores/user'
import type { MenuItem } from '@/types/contract'

type AsyncComponent = () => Promise<{ default: Component }>

const viewModules = import.meta.glob('../views/**/*.vue') as Record<string, AsyncComponent>

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/index.vue'),
    meta: { public: true, title: '登录' }
  },
  {
    path: '/',
    name: 'root',
    component: MainLayout,
    redirect: '/dashboard',
    children: []
  },
  {
    path: '/supplier-portal/login',
    name: 'supplier-portal-login',
    component: () => import('@/views/supplier-portal/login.vue'),
    meta: { public: true, title: '供应商门户登录' }
  },
  {
    path: '/supplier-portal',
    name: 'supplier-portal',
    component: () => import('@/views/supplier-portal/index.vue'),
    meta: { public: true, title: '供应商协同门户' }
  },
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/views/common/forbidden/index.vue'),
    meta: { public: true, title: '无权限' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/common/not-found/index.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const addedRouteNames: string[] = []
const reroutedPaths = new Set<string>()

function resolveComponent(componentPath: string): AsyncComponent {
  const fallback = () => import('@/views/common/coming-soon/index.vue')
  if (!componentPath) {
    return fallback
  }
  return viewModules[`../views/${componentPath}.vue`] ?? fallback
}

function flattenMenus(menus: MenuItem[]): MenuItem[] {
  const result: MenuItem[] = []
  for (const menu of menus) {
    result.push(menu)
    result.push(...flattenMenus(menu.children ?? []))
  }
  return result
}

function addMenuRoutes(menus: MenuItem[]): void {
  const flatMenus = flattenMenus(menus)
  for (const menu of flatMenus) {
    if (!menu.component || !menu.path) {
      continue
    }
    const name = `menu-${menu.id}`
    if (router.hasRoute(name)) {
      continue
    }
    router.addRoute('root', {
      path: menu.path.replace(/^\//, ''),
      name,
      component: resolveComponent(menu.component),
      meta: {
        title: menu.title,
        perm: menu.perm,
        icon: menu.icon,
        hidden: menu.hidden,
        keepAlive: true
      }
    })
    addedRouteNames.push(name)
  }
}

export function resetDynamicRoutes(): void {
  for (const name of addedRouteNames) {
    if (router.hasRoute(name)) {
      router.removeRoute(name)
    }
  }
  addedRouteNames.length = 0
  reroutedPaths.clear()
}

router.beforeEach(async (to) => {
  if (to.meta.public === true) {
    return true
  }

  const userStore = useUserStore()
  if (!userStore.token) {
    resetDynamicRoutes()
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (!userStore.profile || userStore.menus.length === 0) {
    try {
      await userStore.bootstrap()
    } catch {
      await userStore.logout()
      resetDynamicRoutes()
      return { path: '/login', query: { redirect: to.fullPath } }
    }
  }

  addMenuRoutes(userStore.menus)

  if (to.name === 'not-found' && !reroutedPaths.has(to.fullPath)) {
    reroutedPaths.add(to.fullPath)
    return { path: to.fullPath, replace: true }
  }

  if (to.path === '/') {
    return { path: '/dashboard', replace: true }
  }
  if (typeof to.meta.perm === 'string' && to.meta.perm && !userStore.hasPerm(to.meta.perm)) {
    return { path: '/403' }
  }
  return true
})

export default router
