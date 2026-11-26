const BASE = process.env.API_BASE ?? 'http://127.0.0.1:3000/api/v1'
const USERNAME = process.env.INITIAL_ADMIN_USERNAME ?? 'admin'
const PASSWORD = process.env.INITIAL_ADMIN_PASSWORD ?? 'Admin@123456'

let token = ''

async function api(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  const payload = await response.json()
  if (!response.ok || payload.code !== 0) {
    throw new Error(`${method} ${path} 失败：${payload.message ?? response.status}`)
  }
  return payload.data
}

function dayOffset(offset, hour, minute = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  date.setHours(hour, minute, 0, 0)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:${pad(minute)}:00`
}

async function main() {
  const login = await api('POST', '/auth/login', { username: USERNAME, password: PASSWORD })
  token = login.accessToken

  const centers = []
  for (const [code, name] of [
    ['WC-01', '装配一线'],
    ['WC-02', '装配二线'],
    ['WC-03', '质检中心']
  ]) {
    const existing = (await api('GET', '/mfg/work-centers?pageSize=200')).list.find((item) => item.centerCode === code)
    centers.push(existing ?? await api('POST', '/mfg/work-centers', {
      centerCode: code,
      centerName: name,
      capacity: '8'
    }))
  }
  console.log(`工作中心：${centers.length} 个`)

  const planCount = (await api('GET', '/mfg/plans?pageSize=200')).total
  if (planCount >= 10) {
    console.log(`排产任务已有 ${planCount} 条，跳过新增`)
  } else {
    const templates = [
      ['主机总装 A', 0, 8, 12], ['主机总装 B', 0, 13, 17], ['外壳装配', 1, 8, 11],
      ['主板贴片', 1, 13, 18], ['传感器装配', 2, 9, 12], ['成品检测', 2, 14, 17],
      ['包装入库', 3, 8, 11], ['返修复检', 3, 13, 15], ['样机试产', 4, 9, 13],
      ['批次抽检', 4, 14, 17], ['固件烧录', 5, 8, 12], ['老化测试', 5, 13, 18]
    ]
    const tasks = templates.map(([name, offset, fromHour, toHour], index) => ({
      taskName: String(name),
      workCenterId: Number(centers[index % centers.length].id),
      startAt: dayOffset(Number(offset), Number(fromHour)),
      endAt: dayOffset(Number(offset), Number(toHour))
    }))
    await api('POST', '/mfg/plans', { tasks })
    console.log(`排产任务：新增 ${tasks.length} 条`)
  }

  const gantt = await api('GET', '/mfg/extensions/schedule/gantt')
  console.log(`甘特分组：${gantt.centers.length} 个，任务行：${gantt.rows.length} 条`)
  for (const center of gantt.centers) console.log(`  ${center.centerName}: ${center.tasks.length} 条`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
