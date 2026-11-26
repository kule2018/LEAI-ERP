import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function f(name, label, type, options = {}) {
  return { name, label, type, ...options }
}

const pages = [
  {
    route: 'system/company', dir: 'system-company', prefix: 'SystemCompany', table: 'sys_company',
    title: '公司', desc: '维护租户下属公司主体与统一社会信用代码', perm: 'system:company', scope: { org: 'dept', level: 'ORG' }, redis: 'cache',
    similar: 'system/dept', diff: '本页登记公司主体与信用代码，部门页登记组织层级与数据范围',
    fields: [f('companyCode', '公司编码', 'string', { unique: true, required: true, length: 40, list: true }), f('companyName', '公司名称', 'string', { required: true, length: 80, list: true }), f('legalPerson', '法定代表人', 'string', { length: 40, list: true }), f('creditCode', '统一社会信用代码', 'string', { required: true, length: 18, list: true }), f('orgLevel', '组织层级', 'int', { min: 1, max: 10 })],
    rules: ['公司编码租户内唯一', '统一社会信用代码必须为 18 位大写字母或数字'],
    checks: ["if (!/^[0-9A-Z]{18}$/.test(record.creditCode)) throw new BadRequestException('统一社会信用代码格式不正确')"]
  },
  {
    route: 'system/org-tree', dir: 'system-org-tree', prefix: 'SystemOrgTree', table: 'sys_org_tree',
    title: '组织树', desc: '维护组织节点父子关系与展示顺序', perm: 'system:org-tree', scope: { org: 'dept', level: 'ORG' }, redis: 'cache',
    similar: 'system/company', diff: '本页维护组织树父子节点，公司页维护法人主体信息',
    fields: [f('treeCode', '节点编码', 'string', { unique: true, required: true, length: 40, list: true }), f('treeName', '节点名称', 'string', { required: true, length: 80, list: true }), f('parentCode', '父节点编码', 'string', { length: 40, list: true }), f('nodeType', '节点类型', 'select', { options: ['COMPANY', 'DEPT', 'TEAM'], list: true }), f('sortNo', '排序号', 'int', { min: 0 })],
    rules: ['节点编码租户内唯一', '父节点不得等于自身'],
    checks: ["if (record.parentCode && record.parentCode === record.treeCode) throw new BadRequestException('父节点不得等于自身')"]
  },
  {
    route: 'system/dept', dir: 'system-dept', prefix: 'SystemDept', table: 'sys_dept',
    title: '部门', desc: '维护部门档案与部门级数据权限', perm: 'system:dept', scope: { org: 'dept', level: 'DEPT' }, redis: 'cache',
    similar: 'system/company', diff: '本页登记部门层级和数据权限，公司页登记法人主体',
    fields: [f('deptCode', '部门编码', 'string', { unique: true, required: true, length: 40, list: true }), f('deptName', '部门名称', 'string', { required: true, length: 80, list: true }), f('parentDeptCode', '上级部门编码', 'string', { length: 40, list: true }), f('leaderUserId', '部门负责人', 'int', { min: 0 }), f('dataScopeLevel', '数据范围', 'select', { options: ['SELF', 'DEPT', 'ORG', 'ALL'], list: true })],
    rules: ['部门编码租户内唯一', '上级部门不得等于本部门'],
    checks: ["if (record.parentDeptCode === record.deptCode) throw new BadRequestException('上级部门不得等于本部门')"]
  },
  {
    route: 'system/position', dir: 'system-position', prefix: 'SystemPosition', table: 'sys_position',
    title: '岗位', desc: '维护岗位编制与薪资带宽', perm: 'system:position', scope: { org: 'dept', level: 'ORG' }, redis: 'cache',
    similar: 'system/dept', diff: '本页登记岗位编制与薪资带宽，部门页登记组织层级',
    fields: [f('positionCode', '岗位编码', 'string', { unique: true, required: true, length: 40, list: true }), f('positionName', '岗位名称', 'string', { required: true, length: 80, list: true }), f('positionGrade', '职级', 'string', { length: 20, list: true }), f('headcountLimit', '编制人数', 'int', { min: 0 }), f('salaryBandMax', '薪资上限', 'decimal4', { list: true })],
    rules: ['岗位编码租户内唯一', '编制人数与薪资上限不得为负'],
    checks: ['if (record.headcountLimit < 0) throw new BadRequestException(\'编制人数不得为负\')', "if (new Decimal(record.salaryBandMax ?? '0').lt(0)) throw new BadRequestException('薪资上限不得为负')"]
  },
  {
    route: 'system/user', dir: 'system-user', prefix: 'SystemUser', table: 'sys_user',
    title: '用户', desc: '维护登录账号、实名与所属部门', perm: 'system:user', scope: { org: 'dept', level: 'SELF' }, redis: 'cache',
    similar: 'system/role', diff: '本页登记账号与实名信息，角色页登记角色编码与权限数量',
    fields: [f('username', '登录账号', 'string', { unique: true, required: true, length: 64, list: true }), f('realName', '真实姓名', 'string', { required: true, length: 64, list: true }), f('passwordMask', '密码掩码', 'string', { length: 128 }), f('deptId', '所属部门', 'int', { min: 0, list: true }), f('mobile', '手机号', 'string', { length: 20, list: true })],
    rules: ['登录账号在租户内唯一', '手机号必须为 11 位中国大陆号码', '密码仅存掩码不回传明文'],
    checks: ["if (!/^1[3-9]\\d{9}$/.test(record.mobile)) throw new BadRequestException('手机号格式不正确')"]
  },
  {
    route: 'system/role', dir: 'system-role', prefix: 'SystemRole', table: 'sys_role',
    title: '角色', desc: '维护角色编码与角色级数据范围', perm: 'system:role', scope: { org: 'dept', level: 'ORG' }, redis: 'cache',
    similar: 'system/user', diff: '本页登记角色编码与数据范围，用户页登记账号与部门',
    fields: [f('roleCode', '角色编码', 'string', { unique: true, required: true, length: 32, list: true }), f('roleName', '角色名称', 'string', { required: true, length: 64, list: true }), f('dataScopeType', '数据范围', 'select', { options: ['SELF', 'DEPT', 'ORG', 'ALL'], list: true }), f('menuPermCount', '菜单权限数', 'int', { min: 0, list: true })],
    rules: ['角色编码租户内唯一', '菜单权限数不得为负'],
    checks: ['if (record.menuPermCount < 0) throw new BadRequestException(\'菜单权限数不得为负\')']
  },
  {
    route: 'system/perm', dir: 'system-perm', prefix: 'SystemPerm', table: 'sys_perm',
    title: '权限', desc: '维护菜单/按钮/接口权限码与缓存口径', perm: 'system:perm', scope: { org: 'dept', level: 'ALL' }, redis: 'perm',
    similar: 'system/role', diff: '本页登记权限码三段式格式，角色页登记角色数据范围',
    fields: [f('permCode', '权限码', 'string', { unique: true, required: true, length: 64, list: true }), f('permName', '权限名称', 'string', { required: true, length: 64, list: true }), f('permType', '权限类型', 'select', { options: ['MENU', 'BUTTON', 'API'], list: true }), f('scopeUserId', '缓存用户', 'int', { min: 0 }), f('cacheTtlSeconds', '缓存秒数', 'int', { min: 60, max: 1800 })],
    rules: ['权限码租户内唯一且为 module:resource:action', '权限缓存不得超过 1800 秒'],
    checks: ["if (!/^[a-z0-9-]+:[a-z0-9-]+:[a-z]+$/.test(record.permCode)) throw new BadRequestException('权限码格式不正确')", 'if (record.cacheTtlSeconds > 1800) throw new BadRequestException(\'权限缓存不得超过 30 分钟\')']
  },
  {
    route: 'system/datascope', dir: 'system-datascope', prefix: 'SystemDataScope', table: 'sys_data_scope',
    title: '数据权限', desc: '维护组织字段与行级可见范围', perm: 'system:datascope', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/role', diff: '本页定义组织字段与可见级别，角色页只是引用数据范围',
    fields: [f('scopeCode', '规则编码', 'string', { unique: true, required: true, length: 40, list: true }), f('scopeName', '规则名称', 'string', { required: true, length: 80, list: true }), f('orgField', '组织字段', 'select', { options: ['DEPT', 'ORG', 'CREATED_BY'], list: true }), f('scopeLevel', '可见级别', 'select', { options: ['SELF', 'DEPT', 'ORG', 'ALL'], list: true }), f('excludeField', '列级排除', 'string', { length: 80 })],
    rules: ['规则编码租户内唯一', 'CREATED_BY 组织字段只对应 SELF 级别'],
    checks: ["if (record.orgField === 'CREATED_BY' && record.scopeLevel !== 'SELF') throw new BadRequestException('创建人字段只适用于本人范围')"]
  },
  {
    route: 'system/auth', dir: 'system-auth', prefix: 'SystemAuth', table: 'sys_auth_config',
    title: '登录/刷新Token', desc: '维护访问令牌与刷新令牌签发参数', perm: 'system:auth', scope: { org: 'dept', level: 'ALL' }, redis: 'auth',
    similar: 'system/sso', diff: '本页管理 JWT 有效期与签发算法，SSO 管理第三方提供方',
    fields: [f('authCode', '配置编码', 'string', { unique: true, required: true, length: 40, list: true }), f('issuerName', '签发者', 'string', { required: true, length: 64, list: true }), f('tokenTtlSeconds', '访问令牌秒数', 'int', { min: 60, max: 7200, list: true }), f('refreshTtlSeconds', '刷新令牌秒数', 'int', { min: 60, max: 2592000 }), f('algorithm', '签名算法', 'select', { options: ['HS256', 'RS256'], list: true })],
    rules: ['配置编码租户内唯一', '访问令牌不得超过 7200 秒', '刷新令牌必须长于访问令牌'],
    checks: ['if (record.refreshTtlSeconds <= record.tokenTtlSeconds) throw new BadRequestException(\'刷新令牌必须长于访问令牌\')']
  },
  {
    route: 'system/sso', dir: 'system-sso', prefix: 'SystemSso', table: 'sys_sso_config',
    title: 'SSO', desc: '维护 OAuth2、企业微信与钉钉单点登录配置', perm: 'system:sso', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/auth', diff: '本页登记第三方登录提供方，登录页登记 JWT 有效期',
    fields: [f('providerCode', '提供方编码', 'string', { unique: true, required: true, length: 40, list: true }), f('providerType', '提供方类型', 'select', { options: ['OAUTH2', 'WECOM', 'DINGTALK'], list: true }), f('clientId', '客户端 ID', 'string', { required: true, length: 120, list: true }), f('callbackUrl', '回调地址', 'string', { required: true, length: 200 }), f('enabled', '是否启用', 'select', { options: ['YES', 'NO'], list: true })],
    rules: ['提供方编码租户内唯一', '回调地址必须以 http 开头'],
    checks: ["if (!record.callbackUrl.startsWith('http')) throw new BadRequestException('回调地址必须以 http 开头')"]
  },
  {
    route: 'system/mfa', dir: 'system-mfa', prefix: 'SystemMfa', table: 'sys_mfa_config',
    title: 'MFA', desc: '维护双因素认证方式与重试策略', perm: 'system:mfa', scope: { org: 'dept', level: 'SELF' }, redis: 'cache',
    similar: 'system/login-risk', diff: '本页登记双因素方式，登录风控登记失败锁定策略',
    fields: [f('mfaCode', '配置编码', 'string', { unique: true, required: true, length: 40, list: true }), f('method', '认证方式', 'select', { options: ['TOTP', 'SMS', 'EMAIL'], list: true }), f('secretMasked', '密钥掩码', 'string', { length: 100 }), f('retryLimit', '重试上限', 'int', { min: 1, max: 10, list: true }), f('enabled', '是否启用', 'select', { options: ['YES', 'NO'], list: true })],
    rules: ['配置编码租户内唯一', '重试上限不得超过 5 次'],
    checks: ['if (record.retryLimit > 5) throw new BadRequestException(\'重试上限不得超过 5 次\')']
  },
  {
    route: 'system/login-risk', dir: 'system-login-risk', prefix: 'SystemLoginRisk', table: 'sys_login_risk_config',
    title: '登录风控', desc: '维护失败锁定、 IP 白名单与风险等级', perm: 'system:login-risk', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/mfa', diff: '本页登记失败锁定与白名单，MFA 登记双因素方式',
    fields: [f('policyCode', '策略编码', 'string', { unique: true, required: true, length: 40, list: true }), f('maxFailCount', '失败上限', 'int', { min: 1, max: 20, list: true }), f('lockMinutes', '锁定时长', 'int', { min: 1, max: 1440, list: true }), f('ipWhitelist', '白名单', 'string', { length: 200 }), f('riskLevel', '风险等级', 'select', { options: ['LOW', 'MEDIUM', 'HIGH'], list: true })],
    rules: ['策略编码租户内唯一', '失败上限不得超过 10 次', '锁定时长不得超过 60 分钟'],
    checks: ['if (record.maxFailCount > 10) throw new BadRequestException(\'失败上限不得超过 10 次\')', 'if (record.lockMinutes > 60) throw new BadRequestException(\'锁定时长不得超过 60 分钟\')']
  },
  {
    route: 'system/seq-rule', dir: 'system-seq-rule', prefix: 'SystemSeqRule', table: 'sys_seq_rule',
    title: '编码规则', desc: '维护业务编码前缀、日期格式与重置周期', perm: 'system:seq-rule', scope: { org: 'dept', level: 'ORG' }, redis: 'seq', seqPrefixField: 'rulePrefix', seqStepExpr: 'record.stepValue',
    similar: 'system/bill-no', diff: '本页定义规则模板，单据编号页记录实际单号与断号策略',
    fields: [f('bizCode', '业务编码', 'string', { unique: true, required: true, length: 50, list: true }), f('rulePrefix', '编码前缀', 'string', { required: true, length: 20, list: true }), f('dateFormat', '日期格式', 'string', { length: 20, list: true }), f('stepValue', '步长', 'int', { min: 1, max: 1000 }), f('resetCycle', '重置周期', 'select', { options: ['DAILY', 'MONTHLY', 'YEARLY'], list: true }), f('docNo', '当前单号', 'string', { length: 80, list: true })],
    rules: ['业务编码租户内唯一', '步长不得小于 1', '序号键按天分桶'],
    checks: ['if (record.stepValue < 1) throw new BadRequestException(\'步长不得小于 1\')']
  },
  {
    route: 'system/bill-no', dir: 'system-bill-no', prefix: 'SystemBillNo', table: 'sys_bill_no',
    title: '单据编号', desc: '维护单据流水当前序号与断号策略', perm: 'system:bill-no', scope: { org: 'dept', level: 'ORG' }, redis: 'seq', seqPrefixField: 'billPrefix', seqStepExpr: '1',
    similar: 'system/seq-rule', diff: '本页记录当前单号与断号处理，编码规则页只定义模板',
    fields: [f('bizCode', '业务编码', 'string', { unique: true, required: true, length: 50, list: true }), f('billPrefix', '单号前缀', 'string', { required: true, length: 20, list: true }), f('docNo', '当前单号', 'string', { length: 80, list: true }), f('currentSeq', '当前序号', 'int', { min: 0 }), f('gapPolicy', '断号策略', 'select', { options: ['SKIP', 'REUSE'], list: true })],
    rules: ['业务编码租户内唯一', '当前序号不得为负', '序号键按 seq:{tenant}:{biz}:{yyyyMMdd} 分桶'],
    checks: ['if (record.currentSeq < 0) throw new BadRequestException(\'当前序号不得为负\')']
  },
  {
    route: 'system/dict', dir: 'system-dict', prefix: 'SystemDict', table: 'sys_dict',
    title: '字典', desc: '维护字典项与 dict:{type} 缓存口径', perm: 'system:dict', scope: { org: 'dept', level: 'ORG' }, redis: 'dict',
    similar: 'system/param', diff: '本页维护字典项与字典缓存，系统参数维护参数键值',
    fields: [f('dictType', '字典类型', 'string', { unique: true, required: true, length: 50, list: true }), f('dictLabel', '字典名称', 'string', { required: true, length: 100, list: true }), f('dictCode', '字典项编码', 'string', { required: true, length: 50, list: true }), f('dictValue', '字典项值', 'string', { length: 200 }), f('cacheTtlSeconds', '缓存秒数', 'int', { min: 60, max: 7200 })],
    rules: ['字典类型租户内唯一', '字典缓存不得超过 7200 秒'],
    checks: ['if (record.cacheTtlSeconds > 7200) throw new BadRequestException(\'字典缓存不得超过 2 小时\')']
  },
  {
    route: 'system/param', dir: 'system-param', prefix: 'SystemParam', table: 'sys_param',
    title: '系统参数', desc: '维护全局与业务参数及其生效范围', perm: 'system:param', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/dict', diff: '本页维护参数键值，字典页维护字典项与缓存',
    fields: [f('paramKey', '参数键', 'string', { unique: true, required: true, length: 80, list: true }), f('paramValue', '参数值', 'string', { required: true, length: 200, list: true }), f('paramGroup', '参数分组', 'string', { length: 60, list: true }), f('valueType', '值类型', 'select', { options: ['STRING', 'INT', 'DECIMAL', 'BOOL'], list: true }), f('effectScope', '生效范围', 'select', { options: ['GLOBAL', 'TENANT'], list: true })],
    rules: ['参数键租户内唯一且为小写点分格式', 'BOOL 类型参数值只能为 YES 或 NO'],
    checks: ["if (!/^[a-z0-9.]+$/.test(record.paramKey)) throw new BadRequestException('参数键格式不正确')", "if (record.valueType === 'BOOL' && !['YES', 'NO'].includes(record.paramValue)) throw new BadRequestException('布尔参数值不合法')"]
  },
  {
    route: 'system/lang', dir: 'system-lang', prefix: 'SystemLang', table: 'sys_lang',
    title: '语言包', desc: '维护多语言资源键与区域语言包', perm: 'system:lang', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/dict', diff: '本页维护语言资源与区域码，字典页维护业务枚举',
    fields: [f('langCode', '语言编码', 'string', { unique: true, required: true, length: 20, list: true }), f('localeName', '区域名称', 'string', { required: true, length: 60, list: true }), f('resourceKey', '资源键', 'string', { required: true, length: 100, list: true }), f('resourceValue', '资源值', 'string', { length: 300 }), f('fallbackLang', '回退语言', 'string', { length: 20 })],
    rules: ['语言编码租户内唯一', '区域编码必须为 zh_CN / en_US 格式'],
    checks: ["if (!/^[a-z]{2}_[A-Z]{2}$/.test(record.langCode)) throw new BadRequestException('区域编码格式不正确')"]
  },
  {
    route: 'system/currency', dir: 'system-currency', prefix: 'SystemCurrency', table: 'sys_currency',
    title: '币种', desc: '维护币种代码、符号与小数位', perm: 'system:currency', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/rate', diff: '本页登记币种主数据，汇率页登记币种间换算值',
    fields: [f('currencyCode', '币种编码', 'string', { unique: true, required: true, length: 8, list: true }), f('currencyName', '币种名称', 'string', { required: true, length: 60, list: true }), f('symbol', '货币符号', 'string', { length: 8, list: true }), f('decimalPlaces', '小数位', 'int', { min: 0, max: 6, list: true }), f('isBase', '是否本位币', 'select', { options: ['YES', 'NO'], list: true })],
    rules: ['币种编码必须为三位大写字母且租户内唯一', '本位币小数位必须为 2'],
    checks: ["if (!/^[A-Z]{3}$/.test(record.currencyCode)) throw new BadRequestException('币种编码格式不正确')", "if (record.isBase === 'YES' && record.decimalPlaces !== 2) throw new BadRequestException('本位币小数位必须为 2')"]
  },
  {
    route: 'system/rate', dir: 'system-rate', prefix: 'SystemRate', table: 'sys_rate',
    title: '汇率', desc: '维护币种间汇率值与生效日期', perm: 'system:rate', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/currency', diff: '本页登记换算汇率，币种页登记币种主数据',
    fields: [f('ratePairCode', '货币对编码', 'string', { unique: true, required: true, length: 20, list: true }), f('targetCurrency', '目标币种', 'string', { required: true, length: 8, list: true }), f('rateValue', '汇率值', 'decimal4', { required: true, list: true }), f('effectiveDate', '生效日期', 'string', { length: 20, list: true }), f('source', '来源', 'select', { options: ['MANUAL', 'AUTO'], list: true })],
    rules: ['货币对编码租户内唯一', '汇率值必须大于 0'],
    checks: ["if (new Decimal(record.rateValue ?? '0').lte(0)) throw new BadRequestException('汇率值必须大于 0')"]
  },
  {
    route: 'system/log-login', dir: 'system-log-login', prefix: 'SystemLogLogin', table: 'sys_login_log',
    title: '登录日志', desc: '记录账号、来源 IP 与登录结果', perm: 'system:log-login', scope: { org: 'dept', level: 'SELF' }, redis: 'cache',
    similar: 'system/log-op', diff: '本页记录登录事件，操作日志记录业务操作事件',
    fields: [f('logNo', '日志编号', 'string', { unique: true, required: true, length: 60, list: true }), f('loginAccount', '登录账号', 'string', { required: true, length: 64, list: true }), f('loginIp', '来源 IP', 'string', { length: 40, list: true }), f('loginResult', '登录结果', 'select', { options: ['SUCCESS', 'FAIL'], list: true }), f('failReason', '失败原因', 'string', { length: 200 })],
    rules: ['日志编号租户内唯一', '登录失败时失败原因必填'],
    checks: ["if (record.loginResult === 'FAIL' && !record.failReason?.trim()) throw new BadRequestException('失败原因必填')"]
  },
  {
    route: 'system/log-op', dir: 'system-log-op', prefix: 'SystemLogOp', table: 'sys_op_log',
    title: '操作日志', desc: '记录模块、动作与业务对象标识', perm: 'system:log-op', scope: { org: 'dept', level: 'DEPT' }, redis: 'cache',
    similar: 'system/log-login', diff: '本页记录业务操作，登录日志记录认证事件',
    fields: [f('logNo', '日志编号', 'string', { unique: true, required: true, length: 60, list: true }), f('moduleName', '模块名', 'string', { required: true, length: 60, list: true }), f('actionName', '动作名', 'string', { required: true, length: 60, list: true }), f('bizIdValue', '业务标识', 'int', { min: 0, list: true }), f('operatorNote', '操作说明', 'string', { length: 255 })],
    rules: ['日志编号租户内唯一', '模块名与动作名不得为空'],
    checks: ["if (!record.moduleName?.trim() || !record.actionName?.trim()) throw new BadRequestException('模块名与动作名不得为空')"]
  },
  {
    route: 'system/log-change', dir: 'system-log-change', prefix: 'SystemLogChange', table: 'sys_change_log',
    title: '变更日志', desc: '记录字段级前后值与所属表', perm: 'system:log-change', scope: { org: 'dept', level: 'DEPT' }, redis: 'cache',
    similar: 'system/log-op', diff: '本页记录字段前后值，操作日志只记录动作',
    fields: [f('logNo', '日志编号', 'string', { unique: true, required: true, length: 60, list: true }), f('tableName', '数据表', 'string', { required: true, length: 60, list: true }), f('fieldName', '字段名', 'string', { required: true, length: 60, list: true }), f('oldValue', '变更前值', 'string', { length: 200, list: true }), f('newValue', '变更后值', 'string', { length: 200, list: true })],
    rules: ['日志编号租户内唯一', '前后值不得相同'],
    checks: ["if (record.oldValue === record.newValue) throw new BadRequestException('前后值不得相同')"]
  },
  {
    route: 'system/notify', dir: 'system-notify', prefix: 'SystemNotify', table: 'sys_notify',
    title: '通知中心', desc: '维护多渠道通知与已读状态', perm: 'system:notify', scope: { org: 'dept', level: 'SELF' }, redis: 'cache',
    similar: 'system/log-op', diff: '本页维护通知内容与已读状态，操作日志只做事件留痕',
    fields: [f('notifyNo', '通知编号', 'string', { unique: true, required: true, length: 60, list: true }), f('title', '通知标题', 'string', { required: true, length: 120, list: true }), f('channel', '推送渠道', 'select', { options: ['INMAIL', 'EMAIL', 'SMS', 'WECOM', 'DINGTALK'], list: true }), f('readFlag', '是否已读', 'select', { options: ['YES', 'NO'], list: true }), f('receiverId', '接收人', 'int', { min: 0 })],
    rules: ['通知编号租户内唯一', '通知标题不得为空'],
    checks: ["if (!record.title?.trim()) throw new BadRequestException('通知标题不得为空')"]
  },
  {
    route: 'system/file', dir: 'system-file', prefix: 'SystemFile', table: 'sys_file_storage',
    title: '文件存储', desc: '维护对象存储桶与文件元信息', perm: 'system:file', scope: { org: 'dept', level: 'ORG' }, redis: 'cache',
    similar: 'system/notify', diff: '本页登记存储对象元信息，通知页登记消息内容',
    fields: [f('bucketName', '存储桶', 'string', { unique: true, required: true, length: 80, list: true }), f('objectKey', '对象键', 'string', { required: true, length: 200, list: true }), f('mimeType', '文件类型', 'string', { length: 100, list: true }), f('sizeBytes', '文件大小', 'int', { min: 0, list: true }), f('storageDriver', '存储驱动', 'select', { options: ['MINIO', 'OSS'], list: true })],
    rules: ['存储桶租户内唯一', '文件大小不得超过 52428800 字节'],
    checks: ['if (record.sizeBytes > 52428800) throw new BadRequestException(\'文件大小超过上限\')']
  },
  {
    route: 'system/job', dir: 'system-job', prefix: 'SystemJob', table: 'sys_job',
    title: '定时任务', desc: '维护任务 CRON 表达式与重试策略', perm: 'system:job', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/job-log', diff: '本页定义任务调度，执行日志记录运行结果',
    fields: [f('jobCode', '任务编码', 'string', { unique: true, required: true, length: 50, list: true }), f('jobName', '任务名称', 'string', { required: true, length: 100, list: true }), f('cronExpr', 'CRON 表达式', 'string', { required: true, length: 60, list: true }), f('handlerClass', '处理器', 'string', { length: 120 }), f('maxRetry', '最大重试', 'int', { min: 0, max: 10 })],
    rules: ['任务编码租户内唯一', 'CRON 表达式必须有 5 段'],
    checks: ["if (record.cronExpr.trim().split(/\\s+/).length !== 5) throw new BadRequestException('CRON 表达式必须有 5 段')"]
  },
  {
    route: 'system/job-log', dir: 'system-job-log', prefix: 'SystemJobLog', table: 'sys_job_log',
    title: '执行日志', desc: '记录任务执行耗时与结果', perm: 'system:job-log', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/job', diff: '本页记录单次执行结果，定时任务页定义调度规则',
    fields: [f('logNo', '日志编号', 'string', { unique: true, required: true, length: 60, list: true }), f('jobName', '任务名称', 'string', { required: true, length: 100, list: true }), f('executeTime', '执行时间', 'string', { length: 30, list: true }), f('durationMs', '耗时毫秒', 'int', { min: 0, list: true }), f('result', '执行结果', 'select', { options: ['SUCCESS', 'FAIL'], list: true })],
    rules: ['日志编号租户内唯一', '耗时不得为负'],
    checks: ['if (record.durationMs < 0) throw new BadRequestException(\'耗时不得为负\')']
  },
  {
    route: 'system/openapi', dir: 'system-openapi', prefix: 'SystemOpenapi', table: 'sys_openapi',
    title: 'OpenAPI', desc: '维护开放接口路径、鉴权方式与限流', perm: 'system:openapi', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/apikey', diff: '本页登记接口定义，API Key 页登记调用凭证',
    fields: [f('apiCode', '接口编码', 'string', { unique: true, required: true, length: 50, list: true }), f('apiPath', '接口路径', 'string', { required: true, length: 120, list: true }), f('httpMethod', '请求方法', 'select', { options: ['GET', 'POST', 'PUT', 'DELETE'], list: true }), f('rateLimitQps', '限流QPS', 'int', { min: 1, max: 1000, list: true }), f('authType', '鉴权方式', 'select', { options: ['API_KEY', 'SIGN'], list: true })],
    rules: ['接口编码租户内唯一', '接口路径必须以 / 开头'],
    checks: ["if (!record.apiPath.startsWith('/')) throw new BadRequestException('接口路径必须以 / 开头')"]
  },
  {
    route: 'system/apikey', dir: 'system-apikey', prefix: 'SystemApikey', table: 'sys_api_key',
    title: 'API Key', desc: '维护访问密钥掩码、作用域与有效期', perm: 'system:apikey', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/openapi', diff: '本页登记调用凭证，开放接口页登记接口定义',
    fields: [f('keyId', '密钥标识', 'string', { unique: true, required: true, length: 50, list: true }), f('accessKey', '访问键', 'string', { required: true, length: 120, list: true }), f('secretMask', '密钥掩码', 'string', { length: 120 }), f('scopeText', '作用域', 'string', { length: 200, list: true }), f('expireDays', '有效天数', 'int', { min: 1, max: 365, list: true })],
    rules: ['密钥标识租户内唯一', '密钥掩码不得包含明文口令'],
    checks: ["if (/^sk-|secret-/i.test(record.secretMask ?? '')) throw new BadRequestException('密钥掩码不得包含明文口令')"]
  },
  {
    route: 'system/webhook', dir: 'system-webhook', prefix: 'SystemWebhook', table: 'sys_webhook',
    title: 'Webhook', desc: '维护回调地址、事件类型与重试次数', perm: 'system:webhook', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/openapi', diff: '本页登记外部回调，开放接口页登记内部接口',
    fields: [f('hookCode', '钩子编码', 'string', { unique: true, required: true, length: 50, list: true }), f('endpointUrl', '回调地址', 'string', { required: true, length: 200, list: true }), f('eventType', '事件类型', 'string', { required: true, length: 80, list: true }), f('signSecretMask', '签名密钥掩码', 'string', { length: 120 }), f('retryCount', '重试次数', 'int', { min: 0, max: 10, list: true })],
    rules: ['钩子编码租户内唯一', '回调地址必须以 http 开头', '重试次数不得超过 5'],
    checks: ["if (!record.endpointUrl.startsWith('http')) throw new BadRequestException('回调地址必须以 http 开头')", 'if (record.retryCount > 5) throw new BadRequestException(\'重试次数不得超过 5\')']
  },
  {
    route: 'system/third', dir: 'system-third', prefix: 'SystemThird', table: 'sys_third_cfg',
    title: '第三方配置', desc: '维护商城、物流与支付等第三方平台接入参数', perm: 'system:third', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/sso', diff: '本页登记业务第三方接入，SSO 页登记认证提供方',
    fields: [f('providerCode', '提供方编码', 'string', { unique: true, required: true, length: 50, list: true }), f('providerName', '提供方名称', 'string', { required: true, length: 80, list: true }), f('appId', '应用 ID', 'string', { length: 120, list: true }), f('appSecretMask', '应用密钥掩码', 'string', { length: 120 }), f('callbackUrl', '回调地址', 'string', { length: 200 })],
    rules: ['提供方编码租户内唯一', '回调地址必须以 http 开头', '应用密钥不得明文保存'],
    checks: ["if (record.callbackUrl && !record.callbackUrl.startsWith('http')) throw new BadRequestException('回调地址必须以 http 开头')", "if (/^sk-|secret-/i.test(record.appSecretMask ?? '')) throw new BadRequestException('应用密钥不得明文保存')"]
  },
  {
    route: 'system/backup', dir: 'system-backup', prefix: 'SystemBackup', table: 'sys_backup',
    title: '备份策略', desc: '维护全量/增量备份周期与保留天数', perm: 'system:backup', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/job', diff: '本页定义备份策略，定时任务页定义通用调度',
    fields: [f('policyCode', '策略编码', 'string', { unique: true, required: true, length: 50, list: true }), f('backupType', '备份类型', 'select', { options: ['FULL', 'INCREMENT'], list: true }), f('cronExpr', '备份周期', 'string', { required: true, length: 60, list: true }), f('retentionDays', '保留天数', 'int', { min: 1, max: 365, list: true }), f('storagePath', '存储路径', 'string', { length: 200 })],
    rules: ['策略编码租户内唯一', '保留天数不得少于 7 天', 'CRON 表达式必须有 5 段'],
    checks: ['if (record.retentionDays < 7) throw new BadRequestException(\'保留天数不得少于 7 天\')', "if (record.cronExpr.trim().split(/\\s+/).length !== 5) throw new BadRequestException('CRON 表达式必须有 5 段')"]
  },
  {
    route: 'system/restore', dir: 'system-restore', prefix: 'SystemRestore', table: 'sys_restore',
    title: '恢复', desc: '登记备份恢复单与目标环境', perm: 'system:restore', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/backup', diff: '本页登记恢复执行记录，备份策略页定义周期',
    fields: [f('restoreNo', '恢复单号', 'string', { unique: true, required: true, length: 60, list: true }), f('backupNo', '备份编号', 'string', { required: true, length: 60, list: true }), f('restoreMode', '恢复模式', 'select', { options: ['FULL', 'PITR'], list: true }), f('targetEnv', '目标环境', 'select', { options: ['TEST', 'PROD'], list: true }), f('operatorNote', '操作说明', 'string', { length: 255 })],
    rules: ['恢复单号租户内唯一', '生产环境恢复必须填写操作说明'],
    checks: ["if (record.targetEnv === 'PROD' && !record.operatorNote?.trim()) throw new BadRequestException('生产环境恢复必须填写操作说明')"]
  },
  {
    route: 'system/monitor', dir: 'system-monitor', prefix: 'SystemMonitor', table: 'sys_monitor',
    title: '系统监控', desc: '维护监控指标阈值与告警级别', perm: 'system:monitor', scope: { org: 'dept', level: 'ALL' }, redis: 'cache',
    similar: 'system/job-log', diff: '本页登记指标阈值，执行日志记录单次任务结果',
    fields: [f('metricCode', '指标编码', 'string', { unique: true, required: true, length: 50, list: true }), f('metricName', '指标名称', 'string', { required: true, length: 80, list: true }), f('thresholdValue', '告警阈值', 'string', { required: true, length: 40, list: true }), f('alertLevel', '告警级别', 'select', { options: ['INFO', 'WARN', 'CRITICAL'], list: true }), f('checkIntervalSeconds', '检查间隔', 'int', { min: 10, max: 3600, list: true })],
    rules: ['指标编码租户内唯一', '检查间隔不得低于 10 秒'],
    checks: ['if (record.checkIntervalSeconds < 10) throw new BadRequestException(\'检查间隔不得低于 10 秒\')']
  }
]

function normalize(page) {
  return {
    ...page,
    fields: page.fields.map((field) => ({
      ...field,
      column: field.column ?? field.name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(),
      length: field.length ?? 100,
      required: field.required !== false,
      unique: field.unique === true,
      list: field.list === true,
      options: field.options ?? []
    }))
  }
}

function tsType(field) {
  return field.type === 'int' ? 'number' : 'string'
}

function sqlType(field) {
  if (field.type === 'int') return 'INT'
  if (field.type === 'decimal4') return 'DECIMAL(18, 4)'
  if (field.type === 'decimal3') return 'DECIMAL(18, 3)'
  return 'VARCHAR(' + field.length + ')'
}

function columnDecorator(field) {
  if (field.type === 'int') return "  @Column({ name: '" + field.column + "', type: 'int' })"
  if (field.type === 'decimal4') return "  @Column({ name: '" + field.column + "', type: 'decimal', precision: 18, scale: 4 })"
  if (field.type === 'decimal3') return "  @Column({ name: '" + field.column + "', type: 'decimal', precision: 18, scale: 3 })"
  return "  @Column({ name: '" + field.column + "', type: 'varchar', length: " + field.length + ' })'
}

function validatorImports(page) {
  const set = new Set(['IsOptional', 'IsString', 'MaxLength', 'IsInt', 'Min', 'Max', 'IsNotEmpty'])
  if (page.fields.some((field) => field.type === 'decimal4' || field.type === 'decimal3')) set.add('Matches')
  if (page.fields.some((field) => field.type === 'select')) set.add('IsIn')
  return [...set].sort().join(', ')
}

function entityFile(page) {
  const businessColumns = page.fields
    .map((field) => columnDecorator(field) + '\n  ' + field.name + '!: ' + tsType(field) + '\n')
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

function fieldDecorators(field, optional) {
  const decorators = []
  if (optional) decorators.push('@IsOptional()')
  if (field.type === 'int') {
    decorators.push('@IsInt()')
    if (!optional && field.required) decorators.push('@IsNotEmpty()')
    if (field.min !== undefined) decorators.push('@Min(' + field.min + ')')
    if (field.max !== undefined) decorators.push('@Max(' + field.max + ')')
  } else if (field.type === 'decimal4' || field.type === 'decimal3') {
    const scale = field.type === 'decimal4' ? 4 : 3
    decorators.push('@IsString()')
    if (!optional && field.required) decorators.push('@IsNotEmpty()')
    decorators.push('@Matches(/^\\d+(\\.\\d{1,' + scale + '})?$/, { message: \'' + field.label + '必须为最多 ' + scale + ' 位小数的字符串\' })')
  } else if (field.type === 'select') {
    decorators.push('@IsString()')
    if (!optional && field.required) decorators.push('@IsNotEmpty()')
    decorators.push('@IsIn([' + field.options.map((value) => "'" + value + "'").join(', ') + '])')
  } else {
    decorators.push('@IsString()')
    if (!optional && field.required) decorators.push('@IsNotEmpty()')
    decorators.push('@MaxLength(' + field.length + ')')
  }
  return decorators.join('\n  ')
}

function dtoFile(page) {
  const createFields = page.fields
    .map((field) => '  ' + fieldDecorators(field, false) + '\n  ' + field.name + (field.required ? '!' : '?') + ': ' + tsType(field) + '\n')
    .join('\n')
  const updateFields = page.fields
    .map((field) => '  ' + fieldDecorators(field, true) + '\n  ' + field.name + '?: ' + tsType(field) + '\n')
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

function sideEffectMethod(page) {
  if (page.redis === 'cache') {
    return ''
  }
  let body = ''
  if (page.redis === 'auth') {
    body = `    const key = 'auth:token:' + user.userId
    if (action === 'approve') {
      await this.redis.set(key, 'auth:' + record.id + ':' + user.userId, 'EX', record.tokenTtlSeconds)
    }
    if (action === 'cancel') {
      await this.redis.del(key)
    }`
  } else if (page.redis === 'perm') {
    body = `    const key = 'perm:' + record.scopeUserId
    if (action === 'approve') {
      await this.redis.set(key, JSON.stringify([record.permCode]), 'EX', record.cacheTtlSeconds)
    }
    if (action === 'cancel') {
      await this.redis.del(key)
    }`
  } else if (page.redis === 'dict') {
    body = `    const key = 'dict:' + record.dictType
    if (action === 'approve' || action === 'done') {
      await this.redis.set(key, JSON.stringify(record), 'EX', record.cacheTtlSeconds)
    }
    if (action === 'cancel') {
      await this.redis.del(key)
    }`
  } else {
    body = `    if (action !== 'create') {
      if (action === 'cancel') {
        const day = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        await this.redis.del('seq:' + record.tenantId + ':' + record.bizCode + ':' + day)
      }
      return
    }
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const key = 'seq:' + record.tenantId + ':' + record.bizCode + ':' + day
    const next = await this.redis.incr(key)
    if (next === 1) {
      await this.redis.expire(key, 86400)
    }
    record.docNo = record.${page.seqPrefixField} + day + String(next * ${page.seqStepExpr}).padStart(6, '0')
    await this.repo.save(record)`
  }

  return `
  private async applySideEffect(record: ${page.prefix}Record, action: string, user: JwtUser) {
${body}
  }
`
}

function serviceFile(page) {
  const decimalFields = page.fields.filter((field) => field.type === 'decimal4' || field.type === 'decimal3')
  const needDecimal = decimalFields.length > 0 || page.checks.some((line) => line.includes('Decimal'))
  const searchField = page.fields.find((field) => field.type === 'string' || field.type === 'select') ?? page.fields[0]
  const uniqueChecks = page.fields
    .filter((field) => field.unique)
    .map((field) => {
      return `    const ${field.name}Value = dto.${field.name}\n    if (${field.name}Value !== undefined && ${field.name}Value !== null && ${field.name}Value !== '') {\n      const where: FindOptionsWhere<${page.prefix}Record> = { tenantId, isDeleted: 0, ${field.name}: ${field.name}Value }\n      const existing = await this.repo.findOne({ where })\n      if (existing && existing.id !== excludeId) {\n        throw new ConflictException('${field.label}已存在')\n      }\n    }`
    })
    .join('\n')

  const createDecimal = decimalFields
    .map((field) => {
      const scale = field.type === 'decimal4' ? 4 : 3
      return `    values.${field.name} = new Decimal(dto.${field.name} ?? '0').toFixed(${scale})`
    })
    .join('\n')

  const updateDecimal = decimalFields
    .map((field) => {
      const scale = field.type === 'decimal4' ? 4 : 3
      return `    if (dto.${field.name} !== undefined) {\n      record.${field.name} = new Decimal(dto.${field.name}).toFixed(${scale})\n    }`
    })
    .join('\n')

  const createSideEffect = page.redis === 'seq'
    ? '\n    await this.applySideEffect(saved, \'create\', user)'
    : ''
  const transitionSideEffect = page.redis === 'cache'
    ? ''
    : '\n    await this.applySideEffect(record, action, user)'

  return `import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
${needDecimal ? "import Decimal from 'decimal.js'\n" : ''}import type { Redis } from 'ioredis'
import { FindOptionsWhere, Like, Repository } from 'typeorm'
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
    @InjectRepository(${page.prefix}AuditLog) private readonly auditRepo: Repository<${page.prefix}AuditLog>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis
  ) {}

  async list(query: Query${page.prefix}Dto, user: JwtUser, scope: DataScopeInfo): Promise<PageResult<${page.prefix}Record>> {
    const page = Math.max(1, query.page ?? 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE))
    const cacheKey = 'sys:' + user.tenantId + ':${page.dir}:' + scope.level + ':' + (scope.orgId ?? 0) + ':' + page + ':' + pageSize

    if (!query.keyword) {
      const cached = await this.redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached) as PageResult<${page.prefix}Record>
      }
    }

    const where: FindOptionsWhere<${page.prefix}Record> = { tenantId: user.tenantId, isDeleted: 0 }
    if (scope.level === 'SELF') {
      where.createdBy = user.userId
    }
    if (scope.level === 'DEPT' && scope.orgId !== null) {
      where.orgId = scope.orgId
    }
    if (query.keyword) {
      Object.assign(where, { ${searchField.name}: Like('%' + query.keyword + '%') })
    }

    const [list, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    const result: PageResult<${page.prefix}Record> = { list, total, page, pageSize }

    if (!query.keyword) {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 600)
    }
    return result
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
${createDecimal}
    const record = this.repo.create(values as ${page.prefix}Record)
    const saved = await this.repo.save(record)${createSideEffect}
    await this.invalidateCache(user.tenantId)
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
${updateDecimal}
    record.updatedBy = user.userId
    record.updatedAt = new Date()
    await this.repo.save(record)
    await this.invalidateCache(user.tenantId)
    await this.writeAudit(record, record.status, record.status, 'update', user, '修改关键字段')
    return record
  }

  async remove(id: number, user: JwtUser) {
    const record = await this.findOwned(id, user)
    record.isDeleted = 1
    record.updatedBy = user.userId
    record.updatedAt = new Date()
    await this.repo.save(record)
    await this.invalidateCache(user.tenantId)
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
    // 业务规则：${page.rules.join('；')}
${page.checks.map((line) => '    ' + line).join('\n')}
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
    await this.repo.save(record)${transitionSideEffect}
    await this.invalidateCache(user.tenantId)
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
      note: action + ' · ' + note,
      createdAt: new Date()
    })
    await this.auditRepo.save(log)
  }

  private async invalidateCache(tenantId: number) {
    const pattern = 'sys:' + tenantId + ':${page.dir}:*'
    let cursor = '0'
    do {
      const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = result[0]
      const keys = result[1]
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
    } while (cursor !== '0')
  }
${sideEffectMethod(page)}}
`
}

function controllerFile(page) {
  const actions = ['submit', 'approve', 'partial', 'done', 'cancel']
    .map((action) => `
  @Post(':id/${action}')
  @RequirePerm('${page.perm}:${action}')
  ${action}(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.${action}(id, user)
  }
`)
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
  const interfaceFields = page.fields.map((field) => '  ' + field.name + ': ' + tsType(field)).join('\n')
  const createFields = page.fields
    .map((field) => '  ' + field.name + (field.required ? '' : '?') + ': ' + tsType(field))
    .join('\n')
  const actionFns = ['submit', 'approve', 'partial', 'done', 'cancel']
    .map((action) => `
export function ${action}${page.prefix}(id: number) {
  return request<${page.prefix}Record>({ url: baseUrl + '/' + id + '/${action}', method: 'post' })
}
`)
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
  return request<${page.prefix}Record>({ url: baseUrl + '/' + id, method: 'put', data })
}

export function delete${page.prefix}(id: number) {
  return request<null>({ url: baseUrl + '/' + id, method: 'delete' })
}
${actionFns}`
}

function drawerFile(page) {
  const fieldDefs = page.fields
    .map((field) => {
      if (field.type === 'select') {
        const options = field.options
          .map((value) => "      { label: '" + value + "', value: '" + value + "' }")
          .join(',\n')
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
      return `    {
      key: '${field.name}',
      label: '${field.label}',
      type: 'input',
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
    :is-edit="props.isEdit"
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
    .map((field) => "  { prop: '" + field.name + "', label: '" + field.label + "', width: 140 }")
    .join(',\n')
  const initialFields = page.fields
    .map((field) => '    ' + field.name + ': ' + (field.type === 'int' ? '0' : "''"))
    .join(',\n')
  const actionImports = ['submit', 'approve', 'partial', 'done', 'cancel']
    .map((action) => action + page.prefix)
    .join(', ')
  const actionMap = ['submit', 'approve', 'partial', 'done', 'cancel']
    .map((action) => '  ' + action + ': ' + action + page.prefix)
    .join(',\n')
  const moneyImport = page.fields.some((field) => field.type.startsWith('decimal'))
    ? "import Decimal from 'decimal.js'\n"
    : ''
  const amountField = page.fields.find((field) => field.type === 'decimal4')
  const vueImport = amountField
    ? "import { computed, onMounted, onUnmounted, ref } from 'vue'"
    : "import { onMounted, onUnmounted, ref } from 'vue'"
  const moneyComputed = amountField
    ? `
const amountPreview = computed(() => {
  const value = form.value['${amountField.name}']
  if (typeof value !== 'string' || value.trim() === '') {
    return '0.0000'
  }
  return new Decimal(value).toFixed(4)
})
`
    : ''
  const moneyTemplate = amountField
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

function handleRowClick(row: Record<string, unknown>) {
  selected.value = row as unknown as ${page.prefix}Record
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
  await ElMessageBox.confirm('确认执行该动作？', '提示', { type: 'warning' })
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
${moneyComputed}
onMounted(load)

onUnmounted(() => {
  requestSeq += 1
})
</script>

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
      @row-click="handleRowClick"
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

function migrationFile(allPages) {
  const bt = String.fromCharCode(96)
  const statements = [
    '-- M02 系统管理初始迁移：synchronize=false，所有建表由本文件负责',
    '-- 公共字段与软删除口径见 contracts/entity-base.md',
    ''
  ]

  for (const raw of allPages) {
    const page = normalize(raw)
    const columns = [
      bt + 'id' + bt + ' BIGINT NOT NULL AUTO_INCREMENT',
      bt + 'tenant_id' + bt + ' BIGINT NOT NULL',
      bt + 'created_by' + bt + ' BIGINT NOT NULL',
      bt + 'created_at' + bt + ' DATETIME NOT NULL',
      bt + 'updated_by' + bt + ' BIGINT NULL',
      bt + 'updated_at' + bt + ' DATETIME NULL',
      bt + 'is_deleted' + bt + ' TINYINT(1) NOT NULL DEFAULT 0',
      bt + 'remark' + bt + ' VARCHAR(500) NULL',
      bt + 'org_id' + bt + ' BIGINT NOT NULL DEFAULT 0',
      bt + 'status' + bt + " VARCHAR(24) NOT NULL DEFAULT 'DRAFT'"
    ]
    for (const field of page.fields) {
      columns.push(bt + field.column + bt + ' ' + sqlType(field) + ' ' + (field.required ? 'NOT NULL' : 'NULL'))
    }
    columns.push('PRIMARY KEY (' + bt + 'id' + bt + ')')
    statements.push('-- ' + page.title)
    statements.push('CREATE TABLE IF NOT EXISTS ' + bt + page.table + bt + ' (\n  ' + columns.join(',\n  ') + '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;')

    const auditColumns = [
      bt + 'id' + bt + ' BIGINT NOT NULL AUTO_INCREMENT',
      bt + 'tenant_id' + bt + ' BIGINT NOT NULL',
      bt + 'biz_type' + bt + ' VARCHAR(64) NOT NULL',
      bt + 'biz_id' + bt + ' BIGINT NOT NULL',
      bt + 'from_status' + bt + ' VARCHAR(24) NOT NULL',
      bt + 'to_status' + bt + ' VARCHAR(24) NOT NULL',
      bt + 'operator' + bt + ' BIGINT NOT NULL',
      bt + 'note' + bt + ' VARCHAR(255) NOT NULL',
      bt + 'created_at' + bt + ' DATETIME NOT NULL',
      'PRIMARY KEY (' + bt + 'id' + bt + ')'
    ]
    statements.push('CREATE TABLE IF NOT EXISTS ' + bt + page.table + '_audit_log' + bt + ' (\n  ' + auditColumns.join(',\n  ') + '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;', '')
  }

  return statements.join('\n') + '\n'
}

function write(relativePath, content) {
  const target = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content, 'utf8')
}

function verify(page, files) {
  const all = files.map((file) => file.content).join('\n')
  const otherPrefixes = pages.filter((item) => item.route !== page.route).map((item) => item.prefix)
  const gridSource = fs.readFileSync(path.join(root, 'apps/web/src/components/BaseGrid.vue'), 'utf8')
  const expectedRedisKey = {
    cache: "'sys:'",
    auth: "'auth:token:'",
    perm: "'perm:'",
    dict: "'dict:'",
    seq: "'seq:'"
  }[page.redis]

  const checks = [
    [
      '列表三态齐全',
      all.includes('BaseGrid') &&
        gridSource.includes('暂无数据') &&
        gridSource.includes('加载失败') &&
        all.includes('error')
    ],
    ['状态机正确', all.includes('allowedTransitions') && all.includes('CANCELLED') && all.includes('writeAudit')],
    ['金额 decimal.js', page.fields.some((field) => field.type.startsWith('decimal')) ? all.includes("from 'decimal.js'") : !all.includes('FLOAT')],
    ['带 tenant_id', all.includes("name: 'tenant_id'") && all.includes('tenantId')],
    ['业务前缀独立', all.includes(page.prefix) && all.includes("@Controller('" + page.route + "')")],
    [
      '无其他业务域字样',
      !otherPrefixes.some((prefix) => new RegExp('(?<![A-Za-z])' + prefix + '(?![A-Za-z])').test(all))
    ],
    ['Redis 键规范', all.includes(expectedRedisKey) && all.includes('this.redis')],
    ['路由唯一', all.includes("@Controller('" + page.route + "')")]
  ]
  return checks
}

let generated = 0
for (const raw of pages) {
  const page = normalize(raw)
  const base = 'apps/server/src/modules/' + page.dir
  const files = [
    { path: base + '/' + page.dir + '.entity.ts', content: entityFile(page) },
    { path: base + '/dto.ts', content: dtoFile(page) },
    { path: base + '/' + page.dir + '.service.ts', content: serviceFile(page) },
    { path: base + '/' + page.dir + '.controller.ts', content: controllerFile(page) },
    { path: base + '/' + page.dir + '.module.ts', content: moduleFile(page) },
    { path: 'apps/web/src/api/' + page.dir + '.ts', content: apiFile(page) },
    { path: 'apps/web/src/views/' + page.route + '/' + page.prefix + 'Drawer.vue', content: drawerFile(page) },
    { path: 'apps/web/src/views/' + page.route + '/index.vue', content: indexFile(page) }
  ]

  const checks = verify(page, files)
  const failed = checks.filter(([, ok]) => !ok)
  if (failed.length > 0) {
    throw new Error(page.title + ' 验收失败：' + failed.map(([name]) => name).join('、'))
  }

  for (const file of files) {
    write(file.path, file.content)
  }

  generated += 1
  console.log(
    String(generated).padStart(2, '0') + ' /' + page.route + ' ' + page.title + ' :: ' +
      checks.map(([name]) => '[x] ' + name).join(' ')
  )
  console.log('    最像：' + page.similar + '；差异：' + page.diff)
}

write('apps/server/src/migrations/M02_system.sql', migrationFile(pages))
console.log('\n系统管理共生成 ' + generated + ' 个独立页面，每页 8 个专属文件，并输出 1 份迁移 SQL。')
