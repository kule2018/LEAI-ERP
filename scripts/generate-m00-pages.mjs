import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function snake(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

function f(name, label, type, options = {}) {
  return { name, label, type, ...options }
}

const select = (...values) => values

const pages = [
  {
    route: 'contract/api-response',
    dir: 'contract-api-response',
    prefix: 'ContractApiResponse',
    table: 'contract_api_response_record',
    title: '统一响应契约记录',
    desc: '维护业务码与响应结构样例，验证 code=0 的成功语义',
    perm: 'contract:api-response',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'pagination',
    diff: '本页校验响应码与数据结构，pagination 校验页码与每页上限，字段与规则完全不同',
    fields: [
      f('responseCode', '业务码', 'int', { unique: true, required: true, min: -9999, max: 9999, list: true }),
      f('sampleMessage', '提示样例', 'string', { required: true, length: 200, list: true }),
      f('dataShape', '数据结构', 'select', { required: true, options: select('OBJECT', 'ARRAY', 'NULL'), list: true }),
      f('httpStatus', 'HTTP状态码', 'int', { min: 100, max: 599 })
    ],
    rules: [
      '业务码在同一租户内唯一，重复创建直接拒绝',
      'code=0 的成功样例必须给出 OBJECT 或 ARRAY 数据结构'
    ],
    checks: [
      "if (record.responseCode === 0 && record.dataShape === 'NULL') throw new BadRequestException('成功码不允许使用 NULL 数据结构')"
    ]
  },
  {
    route: 'contract/pagination',
    dir: 'contract-pagination',
    prefix: 'ContractPagination',
    table: 'contract_pagination_record',
    title: '分页契约记录',
    desc: '维护 page/pageSize 的默认口径，验证服务端分页边界',
    perm: 'contract:pagination',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'api-response',
    diff: '本页校验页码与每页上限，api-response 校验响应码与数据结构',
    fields: [
      f('pageSizeDefault', '默认每页', 'int', { unique: true, required: true, min: 1, max: 500, list: true }),
      f('pageSizeMax', '每页上限', 'int', { required: true, min: 20, max: 500, list: true }),
      f('sortWhitelist', '排序白名单', 'string', { required: true, length: 200, list: true }),
      f('serverSide', '服务端分页', 'select', { required: true, options: select('YES', 'NO') })
    ],
    rules: [
      '默认每页在同一租户内唯一',
      '每页上限不得小于默认每页，且必须走服务端分页'
    ],
    checks: [
      'if (record.pageSizeMax < record.pageSizeDefault) throw new BadRequestException(\'每页上限不得小于默认每页\')',
      "if (record.serverSide !== 'YES') throw new BadRequestException('必须启用服务端分页')"
    ]
  },
  {
    route: 'contract/entity-base',
    dir: 'contract-entity-base',
    prefix: 'ContractEntityBase',
    table: 'contract_entity_base_record',
    title: '公共字段契约记录',
    desc: '维护公共列名与约束，验证软删除和租户列口径',
    perm: 'contract:entity-base',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'status-machine',
    diff: '本页登记列定义与软删除约束，status-machine 登记状态跳转与审计要求',
    fields: [
      f('columnName', '列名', 'string', { unique: true, required: true, length: 64, list: true }),
      f('columnType', '列类型', 'string', { required: true, length: 32, list: true }),
      f('nullable', '可空', 'select', { required: true, options: select('YES', 'NO'), list: true }),
      f('softDelete', '软删除', 'select', { required: true, options: select('YES', 'NO') })
    ],
    rules: [
      '列名租户内唯一且必须为 snake_case',
      '公共列必须支持软删除，禁止物理删除'
    ],
    checks: [
      "if (!/^[a-z][a-z0-9_]*$/.test(record.columnName)) throw new BadRequestException('列名必须为 snake_case')",
      "if (record.softDelete !== 'YES') throw new BadRequestException('公共列必须支持软删除')"
    ]
  },
  {
    route: 'contract/status-machine',
    dir: 'contract-status-machine',
    prefix: 'ContractStatusMachine',
    table: 'contract_status_machine_record',
    title: '状态机契约记录',
    desc: '维护状态跳转定义，禁止跨级并强制写审计',
    perm: 'contract:status-machine',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'entity-base',
    diff: '本页登记跳转矩阵，entity-base 登记列定义，字段与校验互不重叠',
    fields: [
      f('actionCode', '动作码', 'string', { unique: true, required: true, length: 32, list: true }),
      f('fromStatus', '起始状态', 'select', { required: true, options: select('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIAL'), list: true }),
      f('toStatus', '目标状态', 'select', { required: true, options: select('SUBMITTED', 'APPROVED', 'PARTIAL', 'DONE', 'CANCELLED'), list: true }),
      f('auditRequired', '写审计', 'select', { required: true, options: select('YES', 'NO') })
    ],
    rules: [
      '动作码租户内唯一',
      '禁止 DRAFT 直接跳到 DONE 或 CANCELLED 以外的跨级，且必须写审计'
    ],
    checks: [
      "if (record.fromStatus === 'DRAFT' && record.toStatus === 'DONE') throw new BadRequestException('禁止跨级跳转')",
      "if (record.auditRequired !== 'YES') throw new BadRequestException('状态跳转必须写审计')"
    ]
  },
  {
    route: 'contract/permission',
    dir: 'contract-permission',
    prefix: 'ContractPermission',
    table: 'contract_permission_record',
    title: '权限契约记录',
    desc: '维护 module:resource:action 权限码与缓存口径',
    perm: 'contract:permission',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'guard-perm',
    diff: '本页登记权限码格式与缓存 TTL，guard-perm 登记守卫与拒绝策略',
    fields: [
      f('permCode', '权限码', 'string', { unique: true, required: true, length: 100, list: true }),
      f('resourceName', '资源名', 'string', { required: true, length: 64, list: true }),
      f('actionName', '动作', 'select', { required: true, options: select('view', 'create', 'update', 'delete', 'submit', 'approve', 'partial', 'done', 'cancel'), list: true }),
      f('cacheTtl', '缓存秒数', 'int', { min: 1, max: 1800 })
    ],
    rules: [
      '权限码租户内唯一且必须符合 module:resource:action',
      '权限缓存 TTL 不得超过 1800 秒（30 分钟）'
    ],
    checks: [
      "if (!/^[a-z0-9-]+:[a-z0-9-]+:[a-z]+$/.test(record.permCode)) throw new BadRequestException('权限码格式不正确')",
      'if (record.cacheTtl > 1800) throw new BadRequestException(\'权限缓存不得超过 30 分钟\')'
    ]
  },
  {
    route: 'contract/money',
    dir: 'contract-money',
    prefix: 'ContractMoney',
    table: 'contract_money_record',
    title: '金额数量契约记录',
    desc: '维护 DECIMAL(18,4) 与 DECIMAL(18,3) 的样例口径',
    perm: 'contract:money',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'ui-money',
    diff: '本页同时校验金额与数量精度，ui-money 只校验金额展示',
    fields: [
      f('currencyCode', '币种', 'string', { unique: true, required: true, length: 8, list: true }),
      f('sampleAmount', '金额样例', 'decimal4', { required: true, list: true }),
      f('sampleQty', '数量样例', 'decimal3', { required: true, list: true }),
      f('scaleMode', '舍入模式', 'select', { options: select('HALF_UP', 'HALF_EVEN') })
    ],
    rules: [
      '币种租户内唯一',
      '金额以 DECIMAL(18,4) 落库、数量以 DECIMAL(18,3) 落库，前端字符串传递并用 decimal.js 重算',
      '金额必须大于 0，数量不得超过额度 1000000'
    ],
    checks: [
      "if (new Decimal(record.sampleAmount ?? '0').lte(0)) throw new BadRequestException('金额样例必须大于 0')",
      "if (new Decimal(record.sampleQty ?? '0').gt('1000000')) throw new BadRequestException('数量样例超出额度')"
    ],
    moneyField: 'sampleAmount',
    qtyFields: ['sampleQty']
  },
  {
    route: 'contract/redis',
    dir: 'contract-redis',
    prefix: 'ContractRedis',
    table: 'contract_redis_record',
    title: '缓存键契约记录',
    desc: '维护键模式、命名空间与短锁 TTL',
    perm: 'contract:redis',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'dict',
    diff: '本页管理键模式与短锁，dict 管理字典项与字典缓存 TTL',
    fields: [
      f('keyPattern', '键模式', 'string', { unique: true, required: true, length: 100, list: true }),
      f('ttlSeconds', '过期秒数', 'int', { required: true, min: 1, max: 604800, list: true }),
      f('namespace', '命名空间', 'string', { required: true, length: 32, list: true }),
      f('eviction', '写入策略', 'select', { options: select('NONE', 'EX', 'NX') })
    ],
    rules: [
      '键模式租户内唯一且必须以命名空间开头',
      '短锁 TTL 必须小于等于 5 秒，避免死锁'
    ],
    checks: [
      "if (!record.keyPattern.startsWith(record.namespace)) throw new BadRequestException('键模式必须以命名空间开头')",
      'if (record.ttlSeconds > 5 && record.keyPattern.startsWith(\'lock:\')) throw new BadRequestException(\'短锁 TTL 不得超过 5 秒\')'
    ],
    redisBehavior: 'lock'
  },
  {
    route: 'base/web-scaffold',
    dir: 'base-web-scaffold',
    prefix: 'BaseWebScaffold',
    table: 'base_web_scaffold_record',
    title: '前端脚手架记录',
    desc: '登记 Vue3+Vite+TS 的工程参数',
    perm: 'base:web-scaffold',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'server-scaffold',
    diff: '本页登记前端框架与 Vite 版本，server-scaffold 登记 Nest 版本与全局前缀',
    fields: [
      f('frameworkName', '框架', 'string', { unique: true, required: true, length: 40, list: true }),
      f('viteMajor', 'Vite主版本', 'int', { min: 4, max: 9, list: true }),
      f('tsStrict', '严格模式', 'select', { options: select('YES', 'NO'), list: true }),
      f('buildCommand', '构建命令', 'string', { length: 100 })
    ],
    rules: ['框架名租户内唯一', 'Vite 主版本不得低于 5', '必须开启 TS 严格模式'],
    checks: [
      'if (record.viteMajor < 5) throw new BadRequestException(\'Vite 主版本不得低于 5\')',
      "if (record.tsStrict !== 'YES') throw new BadRequestException('必须开启严格模式')"
    ]
  },
  {
    route: 'base/server-scaffold',
    dir: 'base-server-scaffold',
    prefix: 'BaseServerScaffold',
    table: 'base_server_scaffold_record',
    title: '后端脚手架记录',
    desc: '登记 NestJS10 工程参数与接口前缀',
    perm: 'base:server-scaffold',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'web-scaffold',
    diff: '本页登记后端版本与全局前缀，web-scaffold 登记前端版本与严格模式',
    fields: [
      f('nestMajor', 'Nest主版本', 'int', { unique: true, required: true, min: 8, max: 12, list: true }),
      f('runtimeName', '运行时', 'string', { length: 40, list: true }),
      f('globalPrefix', '全局前缀', 'string', { required: true, length: 64, list: true }),
      f('swaggerPath', '文档路径', 'string', { length: 64 })
    ],
    rules: ['主版本租户内唯一', '全局前缀与文档路径必须以 / 开头'],
    checks: [
      "if (!record.globalPrefix.startsWith('/')) throw new BadRequestException('全局前缀必须以 / 开头')",
      "if (!record.swaggerPath.startsWith('/')) throw new BadRequestException('文档路径必须以 / 开头')"
    ]
  },
  {
    route: 'base/orm',
    dir: 'base-orm',
    prefix: 'BaseOrm',
    table: 'base_orm_record',
    title: 'TypeORM+MySQL 记录',
    desc: '登记连接参数与迁移策略，synchronize 必须关闭',
    perm: 'base:orm',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'redis-queue',
    diff: '本页登记连接与迁移，redis-queue 登记队列与任务 TTL',
    fields: [
      f('connectionName', '连接名', 'string', { unique: true, required: true, length: 50, list: true }),
      f('tablePrefix', '表前缀', 'string', { length: 30, list: true }),
      f('synchronizeMode', '自动同步', 'select', { required: true, options: select('TRUE', 'FALSE'), list: true }),
      f('migrationPath', '迁移目录', 'string', { required: true, length: 150 })
    ],
    rules: ['连接名租户内唯一', '生产必须关闭自动同步', '必须配置迁移目录'],
    checks: [
      "if (record.synchronizeMode !== 'FALSE') throw new BadRequestException('必须关闭 synchronize')",
      "if (!record.migrationPath.trim()) throw new BadRequestException('必须配置迁移目录')"
    ]
  },
  {
    route: 'base/redis-queue',
    dir: 'base-redis-queue',
    prefix: 'BaseRedisQueue',
    table: 'base_redis_queue_record',
    title: 'Redis7+BullMQ 记录',
    desc: '登记队列并发、重试与任务 TTL',
    perm: 'base:redis-queue',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'orm',
    diff: '本页登记队列运行参数，orm 登记数据库连接与迁移',
    fields: [
      f('queueName', '队列名', 'string', { unique: true, required: true, length: 60, list: true }),
      f('concurrencyLimit', '并发数', 'int', { min: 1, max: 100, list: true }),
      f('retryCount', '重试次数', 'int', { min: 0, max: 10, list: true }),
      f('jobTtlSeconds', '任务TTL', 'int', { min: 1, max: 86400 })
    ],
    rules: ['队列名租户内唯一', '并发数不得超过 32', '任务 TTL 不得低于 60 秒'],
    checks: [
      'if (record.concurrencyLimit > 32) throw new BadRequestException(\'并发数不得超过 32\')',
      'if (record.jobTtlSeconds < 60) throw new BadRequestException(\'任务 TTL 不得低于 60 秒\')'
    ],
    redisBehavior: 'cache',
    redisKeyTemplate: 'queue:base:redis-queue:${record.id}',
    redisTtlField: 'jobTtlSeconds'
  },
  {
    route: 'base/auth-login',
    dir: 'base-auth-login',
    prefix: 'BaseAuthLogin',
    table: 'base_auth_login_record',
    title: '登录/JWT签发记录',
    desc: '登记签发参数与令牌有效期',
    perm: 'base:auth-login',
    scope: { org: 'dept', level: 'SELF' },
    similar: 'auth-refresh',
    diff: '本页管签发与访问令牌有效期，auth-refresh 管刷新令牌与轮换次数',
    fields: [
      f('loginAccount', '登录账号', 'string', { unique: true, required: true, length: 64, list: true }),
      f('issuerName', '签发者', 'string', { length: 64, list: true }),
      f('tokenTtlSeconds', '令牌有效期', 'int', { min: 60, max: 86400, list: true }),
      f('algorithm', '算法', 'select', { options: select('HS256', 'RS256') })
    ],
    rules: ['登录账号租户内唯一', '访问令牌有效期不得超过 7200 秒', '令牌写入 auth:token:{userId}'],
    checks: [
      'if (record.tokenTtlSeconds > 7200) throw new BadRequestException(\'访问令牌有效期不得超过 7200 秒\')'
    ],
    redisBehavior: 'token',
    redisTtlField: 'tokenTtlSeconds'
  },
  {
    route: 'base/auth-refresh',
    dir: 'base-auth-refresh',
    prefix: 'BaseAuthRefresh',
    table: 'base_auth_refresh_record',
    title: '刷新Token记录',
    desc: '登记刷新令牌有效期与轮换策略',
    perm: 'base:auth-refresh',
    scope: { org: 'dept', level: 'SELF' },
    similar: 'auth-login',
    diff: '本页管刷新令牌与复用次数，auth-login 管签发与访问令牌',
    fields: [
      f('refreshAccount', '刷新账号', 'string', { unique: true, required: true, length: 64, list: true }),
      f('refreshTtlSeconds', '刷新有效期', 'int', { min: 60, max: 2592000, list: true }),
      f('rotationEnabled', '轮换', 'select', { options: select('YES', 'NO'), list: true }),
      f('maxReuseCount', '最大复用', 'int', { min: 1, max: 10 })
    ],
    rules: [
      '刷新账号租户内唯一',
      '刷新有效期必须长于访问令牌有效期 7200 秒',
      '开启轮换时最大复用次数不得超过 3'
    ],
    checks: [
      'if (record.refreshTtlSeconds <= 7200) throw new BadRequestException(\'刷新有效期必须长于访问令牌有效期\')',
      "if (record.rotationEnabled === 'YES' && record.maxReuseCount > 3) throw new BadRequestException('轮换开启时复用次数不得超过 3')"
    ],
    redisBehavior: 'token',
    redisTtlField: 'refreshTtlSeconds'
  },
  {
    route: 'base/tenant',
    dir: 'base-tenant',
    prefix: 'BaseTenant',
    table: 'base_tenant_record',
    title: '多租户记录',
    desc: '维护租户编码与隔离级别，验证 tenant_id 注入过滤',
    perm: 'base:tenant',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'datascope',
    diff: '本页管租户编码与隔离级别，datascope 管组织字段与可见范围',
    fields: [
      f('tenantCode', '租户编码', 'string', { unique: true, required: true, length: 40, list: true }),
      f('tenantName', '租户名称', 'string', { required: true, length: 80, list: true }),
      f('isolationLevel', '隔离级别', 'select', { options: select('SCHEMA', 'ROW', 'TABLE'), list: true }),
      f('defaultOrgId', '默认组织', 'int', { min: 0 })
    ],
    rules: ['租户编码租户内唯一且为小写短横线格式', '所有查询必须先按 tenant_id 过滤'],
    checks: [
      "if (!/^[a-z0-9-]{2,40}$/.test(record.tenantCode)) throw new BadRequestException('租户编码格式不正确')"
    ]
  },
  {
    route: 'base/guard-perm',
    dir: 'base-guard-perm',
    prefix: 'BaseGuardPerm',
    table: 'base_guard_perm_record',
    title: 'PermissionsGuard 记录',
    desc: '登记守卫名称、目标权限码与拒绝策略',
    perm: 'base:guard-perm',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'permission',
    diff: '本页管守卫和拒绝策略，permission 管权限码格式与缓存',
    fields: [
      f('guardName', '守卫名', 'string', { unique: true, required: true, length: 60, list: true }),
      f('targetPermCode', '目标权限码', 'string', { length: 100, list: true }),
      f('denyPolicy', '拒绝策略', 'select', { options: select('FORBIDDEN', 'HIDE'), list: true }),
      f('checkOrder', '校验顺序', 'int', { min: 1, max: 999 })
    ],
    rules: ['守卫名租户内唯一且以 Guard 结尾', '校验顺序必须大于等于 1'],
    checks: [
      "if (!record.guardName.endsWith('Guard')) throw new BadRequestException('守卫名必须以 Guard 结尾')",
      'if (record.checkOrder < 1) throw new BadRequestException(\'校验顺序必须大于等于 1\')'
    ]
  },
  {
    route: 'base/datascope',
    dir: 'base-datascope',
    prefix: 'BaseDataScope',
    table: 'base_datascope_record',
    title: '@DataScope 数据权限记录',
    desc: '维护组织字段与可见范围，验证租户后叠加过滤',
    perm: 'base:datascope',
    scope: { org: 'dept', level: 'SELF' },
    similar: 'tenant',
    diff: '本页管组织范围过滤，tenant 管租户编码与隔离级别',
    fields: [
      f('orgFieldName', '组织字段', 'string', { unique: true, required: true, length: 50, list: true }),
      f('scopeLevel', '可见范围', 'select', { required: true, options: select('SELF', 'DEPT', 'ORG', 'ALL'), list: true }),
      f('includeSubordinate', '含下级', 'select', { options: select('YES', 'NO') }),
      f('filterPriority', '过滤优先级', 'int', { min: 1, max: 99, list: true })
    ],
    rules: ['组织字段租户内唯一', '范围 ALL 时必须包含下级', '组织过滤叠加在 tenant_id 之后'],
    checks: [
      "if (record.scopeLevel === 'ALL' && record.includeSubordinate !== 'YES') throw new BadRequestException('全量范围必须包含下级')"
    ]
  },
  {
    route: 'base/http',
    dir: 'base-http',
    prefix: 'BaseHttp',
    table: 'base_http_record',
    title: '请求封装记录',
    desc: '登记基础路径、超时与成功码口径',
    perm: 'base:http',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'ui-page',
    diff: '本页管通信参数与成功码，ui-page 管每页选项与总数展示',
    fields: [
      f('baseUrlPath', '基础路径', 'string', { unique: true, required: true, length: 120, list: true }),
      f('timeoutMs', '超时毫秒', 'int', { min: 1000, max: 60000, list: true }),
      f('retryTimes', '重试次数', 'int', { min: 0, max: 5, list: true }),
      f('successCode', '成功码', 'int', { min: -999, max: 999 })
    ],
    rules: ['基础路径租户内唯一', '成功码必须为 0', '超时不得低于 3000 毫秒'],
    checks: [
      'if (record.successCode !== 0) throw new BadRequestException(\'成功码必须为 0\')',
      'if (record.timeoutMs < 3000) throw new BadRequestException(\'超时不得低于 3000 毫秒\')'
    ]
  },
  {
    route: 'base/ui-table',
    dir: 'base-ui-table',
    prefix: 'BaseUiTable',
    table: 'base_ui_table_record',
    title: '通用表格组件记录',
    desc: '登记表格标题、列数与三态文案',
    perm: 'base:ui-table',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'ui-form',
    diff: '本页管表格列与三态，ui-form 管表单标签与抽屉尺寸',
    fields: [
      f('tableTitle', '表格标题', 'string', { unique: true, required: true, length: 80, list: true }),
      f('columnCount', '列数', 'int', { min: 1, max: 50, list: true }),
      f('rowHeightPx', '行高', 'int', { min: 32, max: 80, list: true }),
      f('emptyText', '空态文案', 'string', { length: 100 })
    ],
    rules: ['表格标题租户内唯一', '行高不得低于 40 像素', '必须配置空状态文案'],
    checks: [
      'if (record.rowHeightPx < 40) throw new BadRequestException(\'行高不得低于 40 像素\')',
      "if (!record.emptyText?.trim()) throw new BadRequestException('必须配置空状态文案')"
    ]
  },
  {
    route: 'base/ui-form',
    dir: 'base-ui-form',
    prefix: 'BaseUiForm',
    table: 'base_ui_form_record',
    title: '通用表单/抽屉记录',
    desc: '登记表单标题、标签宽度与抽屉尺寸',
    perm: 'base:ui-form',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'ui-table',
    diff: '本页管表单布局，ui-table 管表格布局与三态',
    fields: [
      f('formTitle', '表单标题', 'string', { unique: true, required: true, length: 80, list: true }),
      f('labelWidthPx', '标签宽度', 'int', { min: 60, max: 200, list: true }),
      f('drawerWidthPx', '抽屉宽度', 'int', { min: 320, max: 960, list: true }),
      f('columnCount', '列数', 'int', { min: 1, max: 3 })
    ],
    rules: ['表单标题租户内唯一', '抽屉宽度不得低于 480 像素', '表单列数不得超过 2'],
    checks: [
      'if (record.drawerWidthPx < 480) throw new BadRequestException(\'抽屉宽度不得低于 480 像素\')',
      'if (record.columnCount > 2) throw new BadRequestException(\'表单列数不得超过 2\')'
    ]
  },
  {
    route: 'base/ui-page',
    dir: 'base-ui-page',
    prefix: 'BaseUiPage',
    table: 'base_ui_page_record',
    title: '分页组件记录',
    desc: '登记页码键、每页选项与总数展示',
    perm: 'base:ui-page',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'http',
    diff: '本页管分页展示选项，http 管请求超时与成功码',
    fields: [
      f('pageSizeKey', '页码键', 'string', { unique: true, required: true, length: 40, list: true }),
      f('pageSizeOptions', '每页选项', 'string', { required: true, length: 100, list: true }),
      f('showTotal', '显示总数', 'select', { options: select('YES', 'NO'), list: true }),
      f('maxPageSizeLimit', '上限', 'int', { min: 20, max: 500 })
    ],
    rules: ['页码键租户内唯一', '上限不得超过 500', '每页选项必须包含 20'],
    checks: [
      'if (record.maxPageSizeLimit > 500) throw new BadRequestException(\'每页上限不得超过 500\')',
      "if (!record.pageSizeOptions.includes('20')) throw new BadRequestException('每页选项必须包含 20')"
    ]
  },
  {
    route: 'base/ui-money',
    dir: 'base-ui-money',
    prefix: 'BaseUiMoney',
    table: 'base_ui_money_record',
    title: '金额组件记录',
    desc: '登记金额标签与金额样例，验证 decimal.js 重算',
    perm: 'base:ui-money',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'money',
    diff: '本页只管金额展示与符号，money 同时管金额和数量精度',
    fields: [
      f('amountLabel', '金额标签', 'string', { unique: true, required: true, length: 40, list: true }),
      f('sampleAmount', '金额样例', 'decimal4', { required: true, list: true }),
      f('currencySymbol', '货币符号', 'string', { length: 8, list: true }),
      f('thousandSeparator', '千分位', 'select', { options: select('YES', 'NO') })
    ],
    rules: ['金额标签租户内唯一', '金额以字符串传递并用 decimal.js 重算，固定 4 位小数'],
    checks: [
      "if (new Decimal(record.sampleAmount ?? '0').lt(0)) throw new BadRequestException('金额样例不得为负')"
    ],
    moneyField: 'sampleAmount'
  },
  {
    route: 'base/dir-perm',
    dir: 'base-dir-perm',
    prefix: 'BaseDirPerm',
    table: 'base_dir_perm_record',
    title: 'v-perm 指令记录',
    desc: '登记指令名、无权限处理与路由权限码',
    perm: 'base:dir-perm',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'guard-perm',
    diff: '本页管前端指令表现，guard-perm 管后端守卫拒绝策略',
    fields: [
      f('permCode', '指令权限码', 'string', { unique: true, required: true, length: 100, list: true }),
      f('hideMode', '无权限处理', 'select', { options: select('REMOVE', 'DISABLE'), list: true }),
      f('directiveName', '指令名', 'string', { required: true, length: 40, list: true }),
      f('routeMetaPerm', '路由权限码', 'string', { length: 100 })
    ],
    rules: ['指令权限码租户内唯一', '指令名必须为 perm', '权限码需与路由权限码一致'],
    checks: [
      "if (record.directiveName !== 'perm') throw new BadRequestException('指令名必须为 perm')",
      "if (record.routeMetaPerm && record.permCode !== record.routeMetaPerm) throw new BadRequestException('指令权限码必须与路由权限码一致')"
    ]
  },
  {
    route: 'base/dict',
    dir: 'base-dict',
    prefix: 'BaseDict',
    table: 'base_dict_record',
    title: '字典缓存记录',
    desc: '维护字典项与 dict:{type} 缓存口径',
    perm: 'base:dict',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'redis',
    diff: '本页管字典项内容与缓存，redis 管键模式与短锁',
    fields: [
      f('dictType', '字典类型', 'string', { unique: true, required: true, length: 50, list: true }),
      f('dictCode', '字典项编码', 'string', { required: true, length: 50, list: true }),
      f('dictLabel', '字典项名称', 'string', { required: true, length: 100, list: true }),
      f('cacheTtlSeconds', '缓存秒数', 'int', { min: 60, max: 14400 })
    ],
    rules: ['字典类型租户内唯一', '缓存写入 dict:{type}，TTL 不得超过 7200 秒'],
    checks: [
      'if (record.cacheTtlSeconds > 7200) throw new BadRequestException(\'字典缓存不得超过 2 小时\')'
    ],
    redisBehavior: 'cache',
    redisKeyTemplate: 'dict:${record.dictType}',
    redisTtlField: 'cacheTtlSeconds'
  },
  {
    route: 'base/seq',
    dir: 'base-seq',
    prefix: 'BaseSeq',
    table: 'base_seq_rule_record',
    title: '编码规则/单据号记录',
    desc: '维护单号前缀与按天分桶的 seq 序列',
    perm: 'base:seq',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'redis',
    diff: '本页生成 seq 单据号，redis 管理锁键与 TTL',
    fields: [
      f('bizCode', '业务编码', 'string', { unique: true, required: true, length: 50, list: true }),
      f('numberPrefix', '单号前缀', 'string', { required: true, length: 20, list: true }),
      f('dateFormat', '日期格式', 'string', { length: 20, list: true }),
      f('stepValue', '步长', 'int', { min: 1, max: 1000 }),
      f('docNo', '当前单号', 'string', { length: 80 })
    ],
    rules: ['业务编码租户内唯一', '序号按 seq:{tenant}:{biz}:{yyyyMMdd} 按天分桶并设当天过期', '步长不小于 1'],
    checks: [
      'if (record.stepValue < 1) throw new BadRequestException(\'步长不得小于 1\')'
    ],
    redisBehavior: 'sequence'
  },
  {
    route: 'base/file',
    dir: 'base-file',
    prefix: 'BaseFile',
    table: 'base_file_record',
    title: '文件上传记录',
    desc: '登记存储桶、对象键与文件元信息',
    perm: 'base:file',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'audit',
    diff: '本页管文件对象元信息，audit 管操作审计流水',
    fields: [
      f('bucketName', '桶名', 'string', { unique: true, required: true, length: 80, list: true }),
      f('objectKey', '对象键', 'string', { required: true, length: 200, list: true }),
      f('mimeType', '类型', 'string', { length: 100, list: true }),
      f('fileSizeBytes', '字节数', 'int', { min: 0 })
    ],
    rules: ['桶名租户内唯一', '文件大小不得超过 52428800 字节'],
    checks: [
      'if (record.fileSizeBytes > 52428800) throw new BadRequestException(\'文件大小超过上限\')'
    ]
  },
  {
    route: 'base/audit',
    dir: 'base-audit',
    prefix: 'BaseAudit',
    table: 'base_audit_record',
    title: '审计日志拦截记录',
    desc: '登记业务类型、前后状态与操作说明',
    perm: 'base:audit',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'file',
    diff: '本页管审计流水，file 管文件对象信息',
    fields: [
      f('bizType', '业务类型', 'string', { unique: true, required: true, length: 64, list: true }),
      f('bizIdValue', '业务ID', 'int', { min: 0, list: true }),
      f('fromStatus', '前状态', 'select', { options: select('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIAL'), list: true }),
      f('toStatus', '后状态', 'select', { options: select('SUBMITTED', 'APPROVED', 'PARTIAL', 'DONE', 'CANCELLED'), list: true }),
      f('operatorNote', '操作说明', 'string', { length: 255 })
    ],
    rules: ['业务类型租户内唯一', '前后状态不得相同', '状态跳转必须写审计'],
    checks: [
      "if (record.fromStatus === record.toStatus) throw new BadRequestException('前后状态不得相同')"
    ]
  },
  {
    route: 'base/layout',
    dir: 'base-layout',
    prefix: 'BaseLayout',
    table: 'base_layout_record',
    title: '主框架 Layout 记录',
    desc: '登记菜单分组、侧栏配色与页签上限',
    perm: 'base:layout',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'router',
    diff: '本页管界面布局外观，router 管路由路径与菜单可见性',
    fields: [
      f('layoutName', '布局名', 'string', { unique: true, required: true, length: 60, list: true }),
      f('menuGroups', '菜单组数', 'int', { min: 1, max: 10, list: true }),
      f('sidebarColor', '侧栏色值', 'string', { length: 20, list: true }),
      f('tabMaxCount', '页签上限', 'int', { min: 1, max: 30 })
    ],
    rules: ['布局名租户内唯一', '侧栏色值必须为十六进制颜色', '页签上限不得超过 20'],
    checks: [
      "if (!/^#[0-9a-fA-F]{6}$/.test(record.sidebarColor)) throw new BadRequestException('侧栏色值必须为十六进制颜色')",
      'if (record.tabMaxCount > 20) throw new BadRequestException(\'页签上限不得超过 20\')'
    ]
  },
  {
    route: 'base/router',
    dir: 'base-router',
    prefix: 'BaseRouter',
    table: 'base_router_record',
    title: '路由+菜单生成记录',
    desc: '维护路由路径、组件路径与菜单可见性',
    perm: 'base:router',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'layout',
    diff: '本页管路由注册，layout 管菜单分组与配色',
    fields: [
      f('routePath', '路由路径', 'string', { unique: true, required: true, length: 120, list: true }),
      f('componentPath', '组件路径', 'string', { required: true, length: 150, list: true }),
      f('metaPerm', '路由权限码', 'string', { length: 100, list: true }),
      f('hiddenFlag', '隐藏菜单', 'select', { options: select('YES', 'NO'), list: true })
    ],
    rules: ['路由路径租户内唯一且以 / 开头', '隐藏菜单的路由仍需可直达'],
    checks: [
      "if (!record.routePath.startsWith('/')) throw new BadRequestException('路由路径必须以 / 开头')"
    ]
  },
  {
    route: 'base/store',
    dir: 'base-store',
    prefix: 'BaseStore',
    table: 'base_store_record',
    title: 'Pinia 状态记录',
    desc: '登记状态名、持久化键与范围',
    perm: 'base:store',
    scope: { org: 'dept', level: 'ORG' },
    similar: 'layout',
    diff: '本页管状态持久化配置，layout 管菜单与页签外观',
    fields: [
      f('storeName', '状态名', 'string', { unique: true, required: true, length: 60, list: true }),
      f('persistKey', '持久化键', 'string', { length: 80, list: true }),
      f('persistScope', '持久化范围', 'select', { options: select('SESSION', 'LOCAL'), list: true }),
      f('storeVersion', '状态版本', 'int', { min: 1, max: 100 })
    ],
    rules: ['状态名租户内唯一', '持久化键不得包含令牌或密码字样', '状态版本不得小于 1'],
    checks: [
      "if (/token|password|secret/i.test(record.persistKey ?? '')) throw new BadRequestException('持久化键不得包含敏感字样')",
      'if (record.storeVersion < 1) throw new BadRequestException(\'状态版本不得小于 1\')'
    ]
  }
]

const forbiddenWords = ['采购', '销售', '库存', '供应商', '客户订单', ' PurchaseOrder', 'SaleOrder']

function normalize(page) {
  const fields = page.fields.map((field) => ({
    ...field,
    column: field.column ?? snake(field.name),
    length: field.length ?? 100,
    required: field.required !== false,
    unique: field.unique === true,
    list: field.list === true,
    options: field.options ?? []
  }))
  return { ...page, fields }
}

function tsType(field) {
  if (field.type === 'int') return 'number'
  return 'string'
}

function columnDecorator(field) {
  if (field.type === 'int') {
    return `  @Column({ name: '${field.column}', type: 'int' })`
  }
  if (field.type === 'decimal4') {
    return `  @Column({ name: '${field.column}', type: 'decimal', precision: 18, scale: 4 })`
  }
  if (field.type === 'decimal3') {
    return `  @Column({ name: '${field.column}', type: 'decimal', precision: 18, scale: 3 })`
  }
  return `  @Column({ name: '${field.column}', type: 'varchar', length: ${field.length} })`
}

function entityFile(page) {
  const businessColumns = page.fields
    .map((field) => `${columnDecorator(field)}\n  ${field.name}!: ${tsType(field)}\n`)
    .join('\n')

  return `import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { BIZ_STATUS, type BizStatus } from '../../common/contracts'

@Entity('${page.table}', { engine: 'InnoDB' })
export class ${page.prefix}Record {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'created_by', type: 'bigint' })
  createdBy!: number

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt!: Date

  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy!: number | null

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt!: Date | null

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number

  @Column({ name: 'remark', type: 'varchar', length: 500, nullable: true })
  remark!: string | null

  @Column({ name: 'org_id', type: 'bigint', default: 0 })
  orgId!: number

  @Column({ name: 'status', type: 'varchar', length: 24, default: BIZ_STATUS.DRAFT })
  status!: BizStatus

${businessColumns}}

@Entity('${page.table}_audit_log', { engine: 'InnoDB' })
export class ${page.prefix}AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'biz_type', type: 'varchar', length: 64 })
  bizType!: string

  @Column({ name: 'biz_id', type: 'bigint' })
  bizId!: number

  @Column({ name: 'from_status', type: 'varchar', length: 24 })
  fromStatus!: string

  @Column({ name: 'to_status', type: 'varchar', length: 24 })
  toStatus!: string

  @Column({ name: 'operator', type: 'bigint' })
  operator!: number

  @Column({ name: 'note', type: 'varchar', length: 255 })
  note!: string

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt!: Date
}
`
}

function validatorImports(page) {
  const set = new Set(['IsOptional', 'IsString', 'MaxLength', 'IsInt', 'Min', 'Max'])
  if (page.fields.some((field) => field.required)) set.add('IsNotEmpty')
  if (page.fields.some((field) => field.type === 'decimal4' || field.type === 'decimal3')) set.add('Matches')
  if (page.fields.some((field) => field.type === 'select')) set.add('IsIn')
  return [...set].sort().join(', ')
}

function fieldDecorators(field, optional, page) {
  const decorators = []
  if (optional) decorators.push('@IsOptional()')
  if (field.type === 'int') {
    decorators.push('@IsInt()')
    if (!optional && field.required) decorators.push('@IsNotEmpty()')
    if (field.min !== undefined) decorators.push(`@Min(${field.min})`)
    if (field.max !== undefined) decorators.push(`@Max(${field.max})`)
  } else if (field.type === 'decimal4' || field.type === 'decimal3') {
    const scale = field.type === 'decimal4' ? 4 : 3
    decorators.push('@IsString()')
    if (!optional && field.required) decorators.push('@IsNotEmpty()')
    decorators.push(`@Matches(/^\\d+(\\.\\d{1,${scale}})?$/, { message: '${field.label}必须为最多 ${scale} 位小数的字符串' })`)
  } else if (field.type === 'select') {
    decorators.push('@IsString()')
    if (!optional && field.required) decorators.push('@IsNotEmpty()')
    decorators.push(`@IsIn([${field.options.map((value) => `'${value}'`).join(', ')}])`)
  } else {
    decorators.push('@IsString()')
    if (!optional && field.required) decorators.push('@IsNotEmpty()')
    decorators.push(`@MaxLength(${field.length})`)
  }
  void page
  return decorators
}

function dtoFile(page) {
  const createFields = page.fields
    .map((field) => {
      const decorators = fieldDecorators(field, false, page)
      return `  ${decorators.join('\n  ')}\n  ${field.name}${field.required ? '!' : '?'}: ${tsType(field)}\n`
    })
    .join('\n')

  const updateFields = page.fields
    .map((field) => {
      const decorators = fieldDecorators(field, true, page)
      return `  ${decorators.join('\n  ')}\n  ${field.name}?: ${tsType(field)}\n`
    })
    .join('\n')

  return `import { Type } from 'class-transformer'
import { ${validatorImports(page)} } from 'class-validator'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../common/contracts'

export class Create${page.prefix}Dto {
${createFields}
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string
}

export class Update${page.prefix}Dto {
${updateFields}
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string
}

export class Query${page.prefix}Dto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE

  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string
}
`
}

function redisMethod(page) {
  const behavior = page.redisBehavior
  if (!behavior) {
    return ''
  }
  if (behavior === 'lock') {
    return `
  private async applyRedisSideEffect(record: ${page.prefix}Record, action: string, user: JwtUser) {
    const key = \`lock:${page.dir}:\${record.id}\`
    if (action === 'submit') {
      const locked = await this.redis.set(key, String(user.userId), 'EX', 5, 'NX')
      if (locked !== 'OK') {
        throw new ConflictException('短锁未释放，请稍后重试')
      }
    }
    if (action === 'done' || action === 'cancel') {
      await this.redis.del(key)
    }
  }
`
  }
  if (behavior === 'cache') {
    const backtick = String.fromCharCode(96)
    const keyExpression = `${backtick}${page.redisKeyTemplate ?? ''}${backtick}`
    return `
  private async applyRedisSideEffect(record: ${page.prefix}Record, action: string, _user: JwtUser) {
    const key = ${keyExpression}
    if (action === 'approve' || action === 'done') {
      await this.redis.set(key, JSON.stringify(record), 'EX', record.${page.redisTtlField})
    }
    if (action === 'cancel') {
      await this.redis.del(key)
    }
  }
`
  }
  if (behavior === 'token') {
    return `
  private async applyRedisSideEffect(record: ${page.prefix}Record, action: string, user: JwtUser) {
    const key = \`auth:token:\${user.userId}\`
    if (action === 'approve') {
      await this.redis.set(key, \`${page.dir}:\${record.id}:\${user.userId}\`, 'EX', record.${page.redisTtlField})
    }
    if (action === 'cancel') {
      await this.redis.del(key)
    }
  }
`
  }
  return `
  private async applyRedisSideEffect(record: ${page.prefix}Record, action: string, user: JwtUser) {
    if (action !== 'create') {
      return
    }
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const key = \`seq:\${user.tenantId}:\${record.bizCode}:\${day}\`
    const next = await this.redis.incr(key)
    if (next === 1) {
      await this.redis.expire(key, 86400)
    }
    record.docNo = \`\${record.numberPrefix}\${day}\${String(next * record.stepValue).padStart(6, '0')}\`
    await this.repo.save(record)
  }
`
}

function serviceFile(page) {
  const searchField = page.fields.find((field) => field.type === 'string' || field.type === 'select') ?? page.fields[0]
  const uniqueChecks = page.fields
    .filter((field) => field.unique)
    .map((field) => {
      return `    const ${field.name}Value = dto.${field.name}\n    if (${field.name}Value !== undefined && ${field.name}Value !== null && ${field.name}Value !== '') {\n      const where: FindOptionsWhere<${page.prefix}Record> = { tenantId, isDeleted: 0, ${field.name}: ${field.name}Value }\n      const existing = await this.repo.findOne({ where })\n      if (existing && existing.id !== excludeId) {\n        throw new ConflictException('${field.label}已存在')\n      }\n    }`
    })
    .join('\n')

  const decimalFields = page.fields.filter((field) => field.type === 'decimal4' || field.type === 'decimal3')
  const decimalAssignments = decimalFields
    .map((field) => {
      const scale = field.type === 'decimal4' ? 4 : 3
      return `    values.${field.name} = new Decimal(dto.${field.name} ?? '0').toFixed(${scale})`
    })
    .join('\n')

  const recordDecimalAssignments = decimalFields
    .map((field) => {
      const scale = field.type === 'decimal4' ? 4 : 3
      return `    if (dto.${field.name} !== undefined) {\n      record.${field.name} = new Decimal(dto.${field.name}).toFixed(${scale})\n    }`
    })
    .join('\n')

  const normalized = page.fields
    .filter((field) => field.type === 'decimal4' || field.type === 'decimal3') || []
  const needDecimal = normalized.length > 0 || (page.checks ?? []).some((line) => line.includes('Decimal'))
  const needRedis = Boolean(page.redisBehavior)
  const redisInject = needRedis ? ",\n    @Inject('REDIS_CLIENT') private readonly redis: Redis" : ''
  const redisImport = needRedis ? "import type { Redis } from 'ioredis'\n" : ''
  const decimalImport = needDecimal ? "import Decimal from 'decimal.js'\n" : ''
  const redisCall = needRedis ? '\n    await this.applyRedisSideEffect(saved, \'create\', user)' : ''
  const transitionRedisCall = needRedis ? '\n    await this.applyRedisSideEffect(record, action, user)' : ''

  return `import {
  BadRequestException,
  ConflictException,${needRedis ? '\n  Inject,' : ''}
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
${decimalImport}${redisImport}import { FindOptionsWhere, Like, Repository } from 'typeorm'
import {
  BIZ_STATUS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type BizStatus,
  type DataScopeInfo,
  type JwtUser,
  type PageResult
} from '../../common/contracts'
import { ${page.prefix}AuditLog, ${page.prefix}Record } from './${page.dir}.entity'
import { Create${page.prefix}Dto, Query${page.prefix}Dto, Update${page.prefix}Dto } from './dto'

@Injectable()
export class ${page.prefix}Service {
  private readonly allowedTransitions: Record<string, string[]> = {
    submit: ['DRAFT'],
    approve: ['SUBMITTED'],
    partial: ['APPROVED'],
    done: ['APPROVED', 'PARTIAL'],
    cancel: ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIAL']
  }

  private readonly targetStatus: Record<string, BizStatus> = {
    submit: BIZ_STATUS.SUBMITTED,
    approve: BIZ_STATUS.APPROVED,
    partial: BIZ_STATUS.PARTIAL,
    done: BIZ_STATUS.DONE,
    cancel: BIZ_STATUS.CANCELLED
  }

  constructor(
    @InjectRepository(${page.prefix}Record) private readonly repo: Repository<${page.prefix}Record>,
    @InjectRepository(${page.prefix}AuditLog) private readonly auditRepo: Repository<${page.prefix}AuditLog>${redisInject}
  ) {}

  async list(query: Query${page.prefix}Dto, user: JwtUser, scope: DataScopeInfo): Promise<PageResult<${page.prefix}Record>> {
    const where: FindOptionsWhere<${page.prefix}Record> = { tenantId: user.tenantId, isDeleted: 0 }
    if (scope.level === 'SELF') {
      where.createdBy = user.userId
    }
    if (scope.level === 'DEPT' && scope.orgId !== null) {
      where.orgId = scope.orgId
    }
    if (query.keyword) {
      Object.assign(where, { ${searchField.name}: Like(\`%\${query.keyword}%\`) })
    }
    const page = Math.max(1, query.page ?? 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE))
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return { list, total, page, pageSize }
  }

  async create(dto: Create${page.prefix}Dto, user: JwtUser) {
    await this.assertUnique(dto, user.tenantId)
    const values: Partial<${page.prefix}Record> = {
      ...dto,
      tenantId: user.tenantId,
      createdBy: user.userId,
      createdAt: new Date(),
      orgId: user.orgId ?? 0,
      status: BIZ_STATUS.DRAFT
    }
${decimalAssignments}
    const record = this.repo.create(values as ${page.prefix}Record)
    const saved = await this.repo.save(record)${redisCall}
    await this.writeAudit(saved, 'DRAFT', 'DRAFT', 'create', user, '新建')
    return saved
  }

  async update(id: number, dto: Update${page.prefix}Dto, user: JwtUser) {
    const record = await this.findOwned(id, user)
    if (record.status !== BIZ_STATUS.DRAFT) {
      throw new BadRequestException('仅草稿状态允许修改')
    }
    await this.assertUnique(dto, user.tenantId, id)
    Object.assign(record, dto)
${recordDecimalAssignments}
    record.updatedBy = user.userId
    record.updatedAt = new Date()
    await this.repo.save(record)
    await this.writeAudit(record, record.status, record.status, 'update', user, '修改关键字段')
    return record
  }

  async remove(id: number, user: JwtUser) {
    const record = await this.findOwned(id, user)
    record.isDeleted = 1
    record.updatedBy = user.userId
    record.updatedAt = new Date()
    await this.repo.save(record)
    await this.writeAudit(record, record.status, record.status, 'delete', user, '软删除')
  }

  submit(id: number, user: JwtUser) {
    return this.transition(id, user, 'submit')
  }

  approve(id: number, user: JwtUser) {
    return this.transition(id, user, 'approve')
  }

  partial(id: number, user: JwtUser) {
    return this.transition(id, user, 'partial')
  }

  done(id: number, user: JwtUser) {
    return this.transition(id, user, 'done')
  }

  cancel(id: number, user: JwtUser) {
    return this.transition(id, user, 'cancel')
  }

  private async findOwned(id: number, user: JwtUser) {
    const record = await this.repo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!record) {
      throw new NotFoundException('记录不存在')
    }
    return record
  }

  private async assertUnique(dto: Create${page.prefix}Dto | Update${page.prefix}Dto, tenantId: number, excludeId?: number) {
${uniqueChecks}
  }

  private validateOnAction(record: ${page.prefix}Record, _action: string) {
    // 业务规则：${(page.rules ?? []).join('；')}
${(page.checks ?? []).map((line) => `    ${line}`).join('\n')}
  }

  private async transition(id: number, user: JwtUser, action: string) {
    const record = await this.findOwned(id, user)
    const target = this.targetStatus[action]
    if (!target || !this.allowedTransitions[action]?.includes(record.status)) {
      throw new BadRequestException('当前状态不允许执行该动作')
    }
    this.validateOnAction(record, action)
    const from = record.status
    record.status = target
    record.updatedBy = user.userId
    record.updatedAt = new Date()
    await this.repo.save(record)${transitionRedisCall}
    await this.writeAudit(record, from, target, action, user, action)
    return record
  }

  private async writeAudit(record: ${page.prefix}Record, from: string, to: string, action: string, user: JwtUser, note: string) {
    const log = this.auditRepo.create({
      tenantId: record.tenantId,
      bizType: '${page.dir}',
      bizId: record.id,
      fromStatus: from,
      toStatus: to,
      operator: user.userId,
      note: \`\${action} · \${note}\`,
      createdAt: new Date()
    })
    await this.auditRepo.save(log)
  }
${redisMethod(page)}}
`
}

function controllerFile(page) {
  const actions = ['submit', 'approve', 'partial', 'done', 'cancel']
    .map(
      (action) => `
  @Post(':id/${action}')
  @RequirePerm('${page.perm}:${action}')
  ${action}(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.${action}(id, user)
  }
`
    )
    .join('\n')

  return `import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards
} from '@nestjs/common'
import { CurrentDataScope } from '../../common/decorators/current-data-scope.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { DataScopeInfo, JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { ${page.prefix}Service } from './${page.dir}.service'
import { Create${page.prefix}Dto, Query${page.prefix}Dto, Update${page.prefix}Dto } from './dto'

@Controller('${page.route}')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: '${page.scope.org}', level: '${page.scope.level}' })
export class ${page.prefix}Controller {
  constructor(private readonly service: ${page.prefix}Service) {}

  @Get()
  @RequirePerm('${page.perm}:view')
  list(
    @Query() query: Query${page.prefix}Dto,
    @CurrentUser() user: JwtUser,
    @CurrentDataScope() scope: DataScopeInfo
  ) {
    return this.service.list(query, user, scope)
  }

  @Post()
  @RequirePerm('${page.perm}:create')
  create(@Body() dto: Create${page.prefix}Dto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user)
  }

  @Put(':id')
  @RequirePerm('${page.perm}:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Update${page.prefix}Dto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.update(id, dto, user)
  }

  @Delete(':id')
  @RequirePerm('${page.perm}:delete')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.remove(id, user)
  }
${actions}}
`
}

function moduleFile(page) {
  return `import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ${page.prefix}Controller } from './${page.dir}.controller'
import { ${page.prefix}AuditLog, ${page.prefix}Record } from './${page.dir}.entity'
import { ${page.prefix}Service } from './${page.dir}.service'

@Module({
  imports: [TypeOrmModule.forFeature([${page.prefix}Record, ${page.prefix}AuditLog])],
  controllers: [${page.prefix}Controller],
  providers: [${page.prefix}Service],
  exports: [${page.prefix}Service]
})
export class ${page.prefix}Module {}
`
}

function apiFile(page) {
  const interfaceFields = page.fields
    .map((field) => `  ${field.name}: ${tsType(field)}`)
    .join('\n')
  const createFields = page.fields
    .map((field) => `  ${field.name}${field.required ? '' : '?'}: ${tsType(field)}`)
    .join('\n')

  const actionFns = ['submit', 'approve', 'partial', 'done', 'cancel']
    .map(
      (action) => `
export function ${action}${page.prefix}(id: number) {
  return request<${page.prefix}Record>({ url: \`\${baseUrl}/\${id}/${action}\`, method: 'post' })
}
`
    )
    .join('\n')

  return `import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface ${page.prefix}Record {
  id: number
  tenantId: number
  orgId: number
  status: string
  createdAt: string
  remark: string | null
${interfaceFields}
}

export interface Query${page.prefix} extends PageQuery {
  keyword?: string
}

export interface Create${page.prefix} {
${createFields}
  remark?: string
}

export interface Update${page.prefix} extends Partial<Create${page.prefix}> {}

const baseUrl = '/${page.route}'

export function fetch${page.prefix}List(params: Query${page.prefix}) {
  return request<PageResult<${page.prefix}Record>>({ url: baseUrl, method: 'get', params })
}

export function create${page.prefix}(data: Create${page.prefix}) {
  return request<${page.prefix}Record>({ url: baseUrl, method: 'post', data })
}

export function update${page.prefix}(id: number, data: Update${page.prefix}) {
  return request<${page.prefix}Record>({ url: \`\${baseUrl}/\${id}\`, method: 'put', data })
}

export function delete${page.prefix}(id: number) {
  return request<null>({ url: \`\${baseUrl}/\${id}\`, method: 'delete' })
}
${actionFns}`
}

function drawerFile(page) {
  const fieldDefs = page.fields
    .map((field) => {
      if (field.type === 'select') {
        const options = field.options.map((value) => `      { label: '${value}', value: '${value}' }`).join(',\n')
        return `    {
      key: '${field.name}',
      label: '${field.label}',
      type: 'select',
      required: ${field.required},
      options: [
${options}
      ]
    }`
      }
      const type = field.type === 'select' ? 'select' : 'input'
      return `    {
      key: '${field.name}',
      label: '${field.label}',
      type: '${type}',
      required: ${field.required},
      maxlength: ${field.type === 'string' ? field.length : 40}
    }`
    })
    .join(',\n')

  return `<script setup lang="ts">
import { computed } from 'vue'
import BaseDrawer from '@/components/BaseDrawer.vue'

const props = defineProps<{
  modelValue: boolean
  title: string
  form: Record<string, unknown>
  loading: boolean
  isEdit: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:form': [value: Record<string, unknown>]
  submit: []
}>()

const fields = [
${fieldDefs},
  {
    key: 'remark',
    label: '备注',
    type: 'textarea',
    maxlength: 500
  }
]

const submitPerm = computed(() => (props.isEdit ? '${page.perm}:update' : '${page.perm}:create'))
</script>

<template>
  <BaseDrawer
    :model-value="props.modelValue"
    :title="props.title"
    :fields="fields"
    :form="props.form"
    :loading="props.loading"
    :submit-perm="submitPerm"
    @update:model-value="emit('update:modelValue', $event)"
    @update:form="emit('update:form', $event)"
    @submit="emit('submit')"
  />
</template>
`
}

function indexFile(page) {
  const columns = page.fields
    .filter((field) => field.list)
    .slice(0, 4)
    .map((field) => `  { prop: '${field.name}', label: '${field.label}', width: 140 }`)
    .join(',\n')
  const initialFields = page.fields
    .map((field) => `    ${field.name}: ${field.type === 'int' ? 0 : "''"}`)
    .join(',\n')
  const actionImports = ['submit', 'approve', 'partial', 'done', 'cancel']
    .map((action) => `${action}${page.prefix}`)
    .join(', ')
  const actionMap = ['submit', 'approve', 'partial', 'done', 'cancel']
    .map((action) => `  ${action}: ${action}${page.prefix}`)
    .join(',\n')
  const moneyImport = page.moneyField ? "import Decimal from 'decimal.js'\n" : ''
  const vueImport = page.moneyField
    ? "import { computed, onMounted, onUnmounted, ref } from 'vue'"
    : "import { onMounted, onUnmounted, ref } from 'vue'"
  const moneyComputed = page.moneyField
    ? `
const amountPreview = computed(() => {
  const value = form.value['${page.moneyField}']
  if (typeof value !== 'string' || value.trim() === '') {
    return '0.0000'
  }
  return new Decimal(value).toFixed(4)
})
`
    : ''
  const moneyTemplate = page.moneyField
    ? `
      <p class="money-preview">金额重算（decimal.js）：{{ amountPreview }}</p>`
    : ''

  return `<script setup lang="ts">
${vueImport}
import { ElMessage, ElMessageBox } from 'element-plus'
${moneyImport}import ${page.prefix}Drawer from './${page.prefix}Drawer.vue'
import BaseGrid from '@/components/BaseGrid.vue'
import StatusSteps from '@/components/StatusSteps.vue'
import {
  create${page.prefix},
  delete${page.prefix},
  fetch${page.prefix}List,
  update${page.prefix},
  ${actionImports}
} from '@/api/${page.dir}'
import type { ${page.prefix}Record, Create${page.prefix}, Query${page.prefix} } from '@/api/${page.dir}'
import type { BizStatus } from '@/types/contract'

const permPrefix = '${page.perm}'

const columns = [
${columns}
]

const rows = ref<${page.prefix}Record[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<Query${page.prefix}>({ page: 1, pageSize: 20, keyword: '' })
const drawerVisible = ref(false)
const isEdit = ref(false)
const editingId = ref(0)
const submitting = ref(false)
const selected = ref<${page.prefix}Record | null>(null)
const form = ref<Record<string, unknown>>(createEmptyForm())

const actionApis: Record<string, (id: number) => Promise<${page.prefix}Record>> = {
${actionMap}
}

let requestSeq = 0

function createEmptyForm(): Record<string, unknown> {
  return {
${initialFields},
    remark: ''
  }
}

async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetch${page.prefix}List(query.value)
    if (seq !== requestSeq) {
      return
    }
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    if (seq !== requestSeq) {
      return
    }
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) {
      loading.value = false
    }
  }
}

function openAdd() {
  isEdit.value = false
  editingId.value = 0
  form.value = createEmptyForm()
  drawerVisible.value = true
}

function openEdit(row: ${page.prefix}Record) {
  isEdit.value = true
  editingId.value = row.id
  selected.value = row
  form.value = { ...createEmptyForm(), ...row }
  drawerVisible.value = true
}

async function handleSubmit() {
  if (submitting.value) {
    return
  }
  submitting.value = true
  try {
    const payload: Record<string, unknown> = {}
    for (const key of Object.keys(createEmptyForm())) {
      payload[key] = form.value[key]
    }
    const requestData = payload as unknown as Create${page.prefix}
    if (isEdit.value) {
      await update${page.prefix}(editingId.value, requestData)
    } else {
      await create${page.prefix}(requestData)
    }
    ElMessage.success('保存成功')
    drawerVisible.value = false
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: ${page.prefix}Record) {
  await ElMessageBox.confirm('确认软删除该记录？', '提示', { type: 'warning' })
  await delete${page.prefix}(row.id)
  ElMessage.success('已软删除')
  await load()
}

async function handleAction(payload: { action: string; row: ${page.prefix}Record }) {
  const api = actionApis[payload.action]
  if (!api) {
    return
  }
  await ElMessageBox.confirm(\`确认执行该动作？\`, '提示', { type: 'warning' })
  const updated = await api(payload.row.id)
  selected.value = updated
  ElMessage.success('状态已更新')
  await load()
}

function handlePage(value: number) {
  query.value.page = value
  void load()
}

function handlePageSize(value: number) {
  query.value.pageSize = value
  void load()
}

onMounted(load)

onUnmounted(() => {
  requestSeq += 1
})
${moneyComputed}</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>${page.title}</h2>
      <p>${page.desc}</p>
    </header>

    <StatusSteps
      v-if="selected"
      :status="selected.status as BizStatus"
    />

    <BaseGrid
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :error="error"
      :total="total"
      :page="query.page"
      :page-size="query.pageSize"
      :perm-prefix="permPrefix"
      @refresh="load"
      @add="openAdd"
      @edit="openEdit"
      @delete="handleDelete"
      @action="handleAction"
      @update:page="handlePage"
      @update:page-size="handlePageSize"
    />

    <${page.prefix}Drawer
      v-model="drawerVisible"
      :title="isEdit ? '编辑${page.title}' : '新建${page.title}'"
      :form="form"
      :loading="submitting"
      :is-edit="isEdit"
      @update:form="form = $event"
      @submit="handleSubmit"
    />${moneyTemplate}
  </section>
</template>
`
}

function write(relativePath, content) {
  const target = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content, 'utf8')
}

function verify(page, files) {
  const all = files.map((file) => file.content).join('\n')
  const gridSource = fs.readFileSync(path.join(root, 'apps/web/src/components/BaseGrid.vue'), 'utf8')
  const checks = [
    [
      '列表三态齐全',
      all.includes('BaseGrid') &&
        gridSource.includes('暂无数据') &&
        gridSource.includes('加载失败') &&
        gridSource.includes('props.loading') &&
        all.includes('error')
    ],
    ['状态机正确', all.includes('DRAFT') && all.includes('CANCELLED') && all.includes('allowedTransitions')],
    ['金额 decimal.js', page.moneyField ? all.includes("from 'decimal.js'") : !all.includes('FLOAT')],
    ['带 tenant_id', all.includes("name: 'tenant_id'") && all.includes('tenantId')],
    ['业务前缀独立', all.includes(page.prefix) && all.includes(`@Controller('${page.route}')`)],
    ['无其他业务域字样', !forbiddenWords.some((word) => all.includes(word))]
  ]
  return checks
}

function sqlType(field) {
  if (field.type === 'int') return 'INT'
  if (field.type === 'decimal4') return 'DECIMAL(18, 4)'
  if (field.type === 'decimal3') return 'DECIMAL(18, 3)'
  return `VARCHAR(${field.length})`
}

function migrationFile(allPages) {
  const bt = String.fromCharCode(96)
  const statements = [
    '-- M00 初始迁移：synchronize=false，所有建表由本文件负责',
    '-- 公共列与软删除口径见 contracts/entity-base.md',
    ''
  ]

  for (const raw of allPages) {
    const page = normalize(raw)
    const mainColumns = [
      `${bt}id${bt} BIGINT NOT NULL AUTO_INCREMENT`,
      `${bt}tenant_id${bt} BIGINT NOT NULL`,
      `${bt}created_by${bt} BIGINT NOT NULL`,
      `${bt}created_at${bt} DATETIME NOT NULL`,
      `${bt}updated_by${bt} BIGINT NULL`,
      `${bt}updated_at${bt} DATETIME NULL`,
      `${bt}is_deleted${bt} TINYINT(1) NOT NULL DEFAULT 0`,
      `${bt}remark${bt} VARCHAR(500) NULL`,
      `${bt}org_id${bt} BIGINT NOT NULL DEFAULT 0`,
      `${bt}status${bt} VARCHAR(24) NOT NULL DEFAULT 'DRAFT'`
    ]
    for (const field of page.fields) {
      mainColumns.push(
        `${bt}${field.column}${bt} ${sqlType(field)} ${field.required ? 'NOT NULL' : 'NULL'}`
      )
    }
    mainColumns.push(
      `PRIMARY KEY (${bt}id${bt})`,
      `KEY ${bt}idx_tenant_deleted${bt} (${bt}tenant_id${bt}, ${bt}is_deleted${bt})`,
      `KEY ${bt}idx_status${bt} (${bt}status${bt})`
    )

    statements.push(`-- ${page.title}`)
    statements.push(
      `CREATE TABLE IF NOT EXISTS ${bt}${page.table}${bt} (\n  ${mainColumns.join(',\n  ')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    )

    const auditColumns = [
      `${bt}id${bt} BIGINT NOT NULL AUTO_INCREMENT`,
      `${bt}tenant_id${bt} BIGINT NOT NULL`,
      `${bt}biz_type${bt} VARCHAR(64) NOT NULL`,
      `${bt}biz_id${bt} BIGINT NOT NULL`,
      `${bt}from_status${bt} VARCHAR(24) NOT NULL`,
      `${bt}to_status${bt} VARCHAR(24) NOT NULL`,
      `${bt}operator${bt} BIGINT NOT NULL`,
      `${bt}note${bt} VARCHAR(255) NOT NULL`,
      `${bt}created_at${bt} DATETIME NOT NULL`,
      `PRIMARY KEY (${bt}id${bt})`,
      `KEY ${bt}idx_biz${bt} (${bt}tenant_id${bt}, ${bt}biz_type${bt}, ${bt}biz_id${bt})`
    ]
    statements.push(
      `CREATE TABLE IF NOT EXISTS ${bt}${page.table}_audit_log${bt} (\n  ${auditColumns.join(',\n  ')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
      ''
    )
  }

  return statements.join('\n') + '\n'
}

let generated = 0
for (const raw of pages) {
  const page = normalize(raw)
  const base = `apps/server/src/modules/${page.dir}`
  const files = [
    { path: `${base}/${page.dir}.entity.ts`, content: entityFile(page) },
    { path: `${base}/dto.ts`, content: dtoFile(page) },
    { path: `${base}/${page.dir}.service.ts`, content: serviceFile(page) },
    { path: `${base}/${page.dir}.controller.ts`, content: controllerFile(page) },
    { path: `${base}/${page.dir}.module.ts`, content: moduleFile(page) },
    { path: `apps/web/src/api/${page.dir}.ts`, content: apiFile(page) },
    { path: `apps/web/src/views/${page.route}/${page.prefix}Drawer.vue`, content: drawerFile(page) },
    { path: `apps/web/src/views/${page.route}/index.vue`, content: indexFile(page) }
  ]

  const checks = verify(page, files)
  const failed = checks.filter(([, ok]) => !ok)
  if (failed.length > 0) {
    throw new Error(`${page.title} 验收失败：${failed.map(([name]) => name).join('、')}`)
  }

  for (const file of files) {
    write(file.path, file.content)
  }

  generated += 1
  const flags = checks.map(([name]) => `[x] ${name}`).join(' ')
  console.log(`${String(generated).padStart(2, '0')} /contract/${page.route.replace('contract/', '')} ${page.title} :: ${flags}`)
  console.log(`    最像：${page.similar}；差异：${page.diff}`)
}

write('apps/server/src/migrations/M00_initial.sql', migrationFile(pages))

console.log(`\nM00 共生成 ${generated} 个独立页面，每页 8 个专属文件，并输出 1 份初始迁移 SQL。`)
