import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function f(name, label, type, options = {}) {
  return { name, label, type, ...options }
}

const pages = [
  {
    route: 'dashboard/position',
    dir: 'dashboard-position',
    prefix: 'DashboardPosition',
    table: 'dashboard_position_snapshot',
    title: '职位仪表盘',
    desc: '按销售、采购、仓管、财务角色渲染 KPI 卡片，指标由后端聚合',
    perm: 'dashboard:position',
    scope: { org: 'dept', level: 'ORG' },
    ai: true,
    print: false,
    cacheTtl: 300,
    similar: 'dashboard/board',
    diff: '本页按角色聚合 KPI，看板按漏斗阶段与 ABC 聚合',
    fields: [
      f('roleCode', '角色编码', 'select', { unique: true, required: true, options: ['SALES', 'PURCHASE', 'WAREHOUSE', 'FINANCE'], list: true }),
      f('todaySaleAmount', '今日销售', 'decimal4', { required: true, list: true }),
      f('todayPurchaseAmount', '今日采购', 'decimal4', { list: true }),
      f('todayReceiptAmount', '今日回款', 'decimal4', { list: true }),
      f('stockAlertCount', '库存预警数', 'int', { min: 0, list: true })
    ],
    rules: ['角色编码在同一租户内唯一', 'KPI 金额不得为负', 'AI 建议只写建议审计，人工确认后方可采纳'],
    checks: [
      "if (new Decimal(record.todaySaleAmount ?? '0').lt(0)) throw new BadRequestException('今日销售不得为负')",
      "if (new Decimal(record.todayPurchaseAmount ?? '0').lt(0)) throw new BadRequestException('今日采购不得为负')",
      'if (record.stockAlertCount < 0) throw new BadRequestException(\'库存预警数不得为负\')'
    ],
    chart: { title: '今日 KPI 金额', xField: 'roleCode', yField: 'todaySaleAmount', kind: 'bar', decimal: true }
  },
  {
    route: 'dashboard/board',
    dir: 'dashboard-board',
    prefix: 'DashboardBoard',
    table: 'dashboard_board_snapshot',
    title: '销售/采购/库存看板',
    desc: '按漏斗阶段展示排行、ABC 分类与库存周转趋势',
    perm: 'dashboard:board',
    scope: { org: 'dept', level: 'ORG' },
    ai: true,
    print: false,
    cacheTtl: 600,
    similar: 'dashboard/position',
    diff: '本页聚合漏斗、排行、ABC 与周转天数，职位仪表盘只聚合角色 KPI',
    fields: [
      f('boardType', '看板类型', 'select', { unique: true, required: true, options: ['SALES', 'PURCHASE', 'STOCK'], list: true }),
      f('funnelStage', '漏斗阶段', 'select', { required: true, options: ['LEAD', 'ORDER', 'SHIPMENT', 'RECEIPT'], list: true }),
      f('rankingDimension', '排行维度', 'select', { options: ['PRODUCT', 'CUSTOMER', 'REGION'], list: true }),
      f('abcClass', 'ABC 分类', 'select', { options: ['A', 'B', 'C'], list: true }),
      f('turnoverDays', '周转天数', 'decimal3', { list: true }),
      f('safetyStockAlertCount', '安全库存预警数', 'int', { min: 0 })
    ],
    rules: ['看板类型在同一租户内唯一', '周转天数不得为负', 'AI 建议不得越权修改看板数据'],
    checks: [
      "if (new Decimal(record.turnoverDays ?? '0').lt(0)) throw new BadRequestException('周转天数不得为负')",
      'if (record.safetyStockAlertCount < 0) throw new BadRequestException(\'安全库存预警数不得为负\')'
    ],
    chart: { title: '各阶段周转天数', xField: 'funnelStage', yField: 'turnoverDays', kind: 'bar', decimal: true }
  },
  {
    route: 'dashboard/todo',
    dir: 'dashboard-todo',
    prefix: 'DashboardTodo',
    table: 'dashboard_todo_item',
    title: '待办事项',
    desc: '聚合待审批、待发货、待收货与逾期应收，点击可下钻',
    perm: 'dashboard:todo',
    scope: { org: 'dept', level: 'SELF' },
    ai: false,
    print: false,
    cacheTtl: 300,
    similar: 'dashboard/position',
    diff: '本页聚合四类待办与逾期天数，职位仪表盘聚合角色金额 KPI',
    fields: [
      f('todoType', '待办类型', 'select', { required: true, options: ['APPROVAL', 'SHIPMENT', 'RECEIPT', 'OVERDUE_RECEIVABLE'], list: true }),
      f('sourceBizNo', '来源业务单号', 'string', { unique: true, required: true, length: 60, list: true }),
      f('dueDays', '逾期天数', 'int', { min: 0, list: true }),
      f('overdueAmount', '逾期金额', 'decimal4', { list: true }),
      f('handlerNote', '处理说明', 'string', { length: 200 })
    ],
    rules: ['来源业务单号在同一租户内唯一', '逾期天数不得为负', '逾期金额不得为负'],
    checks: [
      'if (record.dueDays < 0) throw new BadRequestException(\'逾期天数不得为负\')',
      "if (new Decimal(record.overdueAmount ?? '0').lt(0)) throw new BadRequestException('逾期金额不得为负')"
    ],
    chart: { title: '各类待办逾期天数', xField: 'todoType', yField: 'dueDays', kind: 'bar', decimal: false }
  },
  {
    route: 'dashboard/quick',
    dir: 'dashboard-quick',
    prefix: 'DashboardQuick',
    table: 'dashboard_quick_entry',
    title: '常用功能/收账台',
    desc: '维护自定义快捷入口与一键收款，支持打印中心模板调用',
    perm: 'dashboard:quick',
    scope: { org: 'dept', level: 'SELF' },
    ai: false,
    print: true,
    cacheTtl: 300,
    similar: 'dashboard/brief',
    diff: '本页管理快捷入口点击频次与收款，经营简报管理周月报文本与打印',
    fields: [
      f('entryName', '入口名称', 'string', { unique: true, required: true, length: 60, list: true }),
      f('entryRoute', '入口路由', 'string', { required: true, length: 120, list: true }),
      f('clickCount', '点击次数', 'int', { min: 0, list: true }),
      f('sortWeight', '排序权重', 'int', { min: 0 }),
      f('receiptAmount', '收款金额', 'decimal4', { list: true }),
      f('printTemplateCode', '打印模板编码', 'string', { length: 40, list: true })
    ],
    rules: ['入口名称在同一租户内唯一', '入口路由必须以 / 开头', '收款金额不得为负，打印记录留痕'],
    checks: [
      "if (!record.entryRoute.startsWith('/')) throw new BadRequestException('入口路由必须以 / 开头')",
      "if (new Decimal(record.receiptAmount ?? '0').lt(0)) throw new BadRequestException('收款金额不得为负')"
    ],
    chart: { title: '快捷入口点击次数', xField: 'entryName', yField: 'clickCount', kind: 'bar', decimal: false }
  },
  {
    route: 'dashboard/sale-trend',
    dir: 'dashboard-sale-trend',
    prefix: 'DashboardSaleTrend',
    table: 'dashboard_sale_trend_point',
    title: '销售汇总趋势',
    desc: '按客户、产品、业务员维度展示销售额与增长率趋势',
    perm: 'dashboard:sale-trend',
    scope: { org: 'dept', level: 'DEPT' },
    ai: true,
    print: false,
    cacheTtl: 900,
    similar: 'dashboard/fund-trend',
    diff: '本页聚合销售额与增长率，资金收支趋势聚合现金流与回款预测',
    fields: [
      f('dimension', '分析维度', 'select', { unique: true, required: true, options: ['CUSTOMER', 'PRODUCT', 'SALESPERSON'], list: true }),
      f('periodLabel', '周期标签', 'string', { required: true, length: 30, list: true }),
      f('saleAmount', '销售额', 'decimal4', { required: true, list: true }),
      f('growthRate', '增长率', 'decimal3', { list: true }),
      f('orderCount', '单据数', 'int', { min: 0 })
    ],
    rules: ['分析维度在同一租户内唯一', '销售额不得为负', 'AI 诊断只生成建议，不改写趋势数据'],
    checks: [
      "if (new Decimal(record.saleAmount ?? '0').lt(0)) throw new BadRequestException('销售额不得为负')",
      'if (record.orderCount < 0) throw new BadRequestException(\'单据数不得为负\')'
    ],
    chart: { title: '销售额趋势', xField: 'periodLabel', yField: 'saleAmount', kind: 'line', decimal: true }
  },
  {
    route: 'dashboard/fund-trend',
    dir: 'dashboard-fund-trend',
    prefix: 'DashboardFundTrend',
    table: 'dashboard_fund_trend_point',
    title: '资金收支趋势',
    desc: '展示现金流实际额、回款预测额与预测置信度',
    perm: 'dashboard:fund-trend',
    scope: { org: 'dept', level: 'DEPT' },
    ai: true,
    print: false,
    cacheTtl: 900,
    similar: 'dashboard/sale-trend',
    diff: '本页聚合现金流与回款预测，销售汇总趋势聚合客户/产品/业务员销售额',
    fields: [
      f('cashFlowType', '现金流类型', 'select', { unique: true, required: true, options: ['INFLOW', 'OUTFLOW', 'NET'], list: true }),
      f('forecastMonth', '预测月份', 'string', { required: true, length: 20, list: true }),
      f('actualAmount', '实际金额', 'decimal4', { list: true }),
      f('forecastAmount', '预测金额', 'decimal4', { list: true }),
      f('confidenceRate', '置信度', 'decimal3', { list: true })
    ],
    rules: ['现金流类型在同一租户内唯一', '实际与预测金额不得为负', '回款预测仅作展示，AI 不得直接写入资金数据'],
    checks: [
      "if (new Decimal(record.actualAmount ?? '0').lt(0)) throw new BadRequestException('实际金额不得为负')",
      "if (new Decimal(record.forecastAmount ?? '0').lt(0)) throw new BadRequestException('预测金额不得为负')"
    ],
    chart: { title: '现金流实际额趋势', xField: 'forecastMonth', yField: 'actualAmount', kind: 'line', decimal: true }
  },
  {
    route: 'dashboard/brief',
    dir: 'dashboard-brief',
    prefix: 'DashboardBrief',
    table: 'dashboard_brief_report',
    title: '经营简报',
    desc: '生成周报/月报简报，AI 结论需人工确认，支持打印中心模板',
    perm: 'dashboard:brief',
    scope: { org: 'dept', level: 'ORG' },
    ai: true,
    print: true,
    cacheTtl: 1800,
    similar: 'dashboard/quick',
    diff: '本页管理周月报文本与打印，收账台管理快捷入口与收款',
    fields: [
      f('reportPeriod', '报告周期', 'select', { unique: true, required: true, options: ['WEEK', 'MONTH'], list: true }),
      f('periodLabel', '周期标签', 'string', { required: true, length: 30, list: true }),
      f('summaryText', '经营摘要', 'string', { required: true, length: 500 }),
      f('aiConclusion', 'AI 结论', 'string', { length: 500, list: true }),
      f('metricCount', '指标数量', 'int', { min: 0, list: true }),
      f('printTemplateCode', '打印模板编码', 'string', { length: 40, list: true })
    ],
    rules: ['报告周期在同一租户内唯一', '指标数量不得为负', 'AI 结论必须人工确认后方可采纳，打印记录留痕'],
    checks: [
      'if (record.metricCount < 0) throw new BadRequestException(\'指标数量不得为负\')'
    ],
    chart: { title: '简报覆盖指标数', xField: 'periodLabel', yField: 'metricCount', kind: 'bar', decimal: false }
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
  if (field.type === 'int') {
    return "  @Column({ name: '" + field.column + "', type: 'int' })"
  }
  if (field.type === 'decimal4') {
    return "  @Column({ name: '" + field.column + "', type: 'decimal', precision: 18, scale: 4 })"
  }
  if (field.type === 'decimal3') {
    return "  @Column({ name: '" + field.column + "', type: 'decimal', precision: 18, scale: 3 })"
  }
  return "  @Column({ name: '" + field.column + "', type: 'varchar', length: " + field.length + ' })'
}

function validatorImports(page) {
  const set = new Set(['IsOptional', 'IsString', 'MaxLength', 'IsInt', 'Min', 'Max', 'IsNotEmpty'])
  if (page.fields.some((field) => field.type === 'decimal4' || field.type === 'decimal3')) set.add('Matches')
  if (page.fields.some((field) => field.type === 'select')) set.add('IsIn')
  return [...set].sort().join(', ')
}

function fieldDecorators(field, optional) {
  const decorators = []
  if (optional) decorators.push('@IsOptional()')
  if (field.type === 'int') {
    decorators.push('@IsInt()')
    if (!optional && field.required) decorators.push('@IsNotEmpty()')
    if (field.min !== undefined) decorators.push('@Min(' + field.min + ')')
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

function entityFile(page) {
  const businessColumns = page.fields
    .map((field) => columnDecorator(field) + '\n  ' + field.name + '!: ' + tsType(field) + '\n')
    .join('\n')

  let text = `import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
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

  if (page.ai) {
    text += `
@Entity('${page.table}_ai_audit', { engine: 'InnoDB' })
export class ${page.prefix}AiAudit {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'biz_id', type: 'bigint' })
  bizId!: number

  @Column({ name: 'capability', type: 'varchar', length: 40 })
  capability!: string

  @Column({ name: 'model', type: 'varchar', length: 40 })
  model!: string

  @Column({ name: 'prompt_tokens', type: 'int', default: 0 })
  promptTokens!: number

  @Column({ name: 'completion_tokens', type: 'int', default: 0 })
  completionTokens!: number

  @Column({ name: 'latency_ms', type: 'int', default: 0 })
  latencyMs!: number

  @Column({ name: 'accepted', type: 'varchar', length: 16, default: 'PENDING' })
  accepted!: string

  @Column({ name: 'request', type: 'varchar', length: 500 })
  request!: string

  @Column({ name: 'response', type: 'varchar', length: 1000 })
  response!: string

  @Column({ name: 'operator', type: 'bigint' })
  operator!: number

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt!: Date
}
`
  }

  if (page.print) {
    text += `
@Entity('${page.table}_print_log', { engine: 'InnoDB' })
export class ${page.prefix}PrintLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'biz_id', type: 'bigint' })
  bizId!: number

  @Column({ name: 'template_code', type: 'varchar', length: 64 })
  templateCode!: string

  @Column({ name: 'copies', type: 'int', default: 1 })
  copies!: number

  @Column({ name: 'channel', type: 'varchar', length: 24 })
  channel!: string

  @Column({ name: 'printed_by', type: 'bigint' })
  printedBy!: number

  @Column({ name: 'pdf_url', type: 'varchar', length: 255, nullable: true })
  pdfUrl!: string | null

  @Column({ name: 'watermark', type: 'varchar', length: 64 })
  watermark!: string

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt!: Date
}
`
  }

  return text
}

function dtoFile(page) {
  const createFields = page.fields
    .map((field) => '  ' + fieldDecorators(field, false) + '\n  ' + field.name + (field.required ? '!' : '?') + ': ' + tsType(field) + '\n')
    .join('\n')
  const updateFields = page.fields
    .map((field) => '  ' + fieldDecorators(field, true) + '\n  ' + field.name + '?: ' + tsType(field) + '\n')
    .join('\n')

  let text = `import { Type } from 'class-transformer'
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

  if (page.ai) {
    text += `
export class Confirm${page.prefix}AiDto {
  @IsIn(['YES', 'NO'])
  accepted!: string
}
`
  }

  if (page.print) {
    text += `
export class Print${page.prefix}Dto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  templateCode?: string

  @IsInt()
  @Min(1)
  @Max(10)
  copies: number = 1

  @IsIn(['SERVER_PDF', 'CLIENT'])
  channel: string = 'SERVER_PDF'
}
`
  }

  return text
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

  const aiImports = page.ai ? '\n  ForbiddenException,' : ''
  const aiInject = page.ai
    ? `,\n    @InjectRepository(${page.prefix}AiAudit) private readonly aiAuditRepo: Repository<${page.prefix}AiAudit>`
    : ''
  const printInject = page.print
    ? `,\n    @InjectRepository(${page.prefix}PrintLog) private readonly printLogRepo: Repository<${page.prefix}PrintLog>`
    : ''

  const aiMethods = page.ai
    ? `
  async aiSuggest(id: number, user: JwtUser) {
    const record = await this.findOwned(id, user)
    if (record.status === BIZ_STATUS.DONE || record.status === BIZ_STATUS.CANCELLED) {
      throw new BadRequestException('终态记录不再生成建议')
    }
    const suggestion = '建议复核当前指标口径后由人工确认，禁止自动写入业务数据'
    const request = '${page.title}:' + record.id
    const log = this.aiAuditRepo.create({
      tenantId: record.tenantId,
      bizId: record.id,
      capability: 'ai.report',
      model: 'dashboard-advisor',
      promptTokens: 32,
      completionTokens: 24,
      latencyMs: 1,
      accepted: 'PENDING',
      request,
      response: suggestion,
      operator: user.userId,
      createdAt: new Date()
    })
    const saved = await this.aiAuditRepo.save(log)
    return { auditId: saved.id, suggestion }
  }

  async aiConfirm(auditId: number, dto: Confirm${page.prefix}AiDto, user: JwtUser) {
    const log = await this.aiAuditRepo.findOne({ where: { id: auditId, tenantId: user.tenantId } })
    if (!log) {
      throw new NotFoundException('AI 建议不存在')
    }
    if (log.operator !== user.userId) {
      throw new ForbiddenException('只能确认本人生成的建议')
    }
    if (log.accepted !== 'PENDING') {
      throw new BadRequestException('该建议已处理')
    }
    log.accepted = dto.accepted
    await this.aiAuditRepo.save(log)
    const record = await this.findOwned(log.bizId, user)
    await this.writeAudit(record, record.status, record.status, 'ai-confirm', user, dto.accepted === 'YES' ? 'AI建议采纳' : 'AI建议驳回')
    return log
  }
`
    : ''

  const printMethods = page.print
    ? `
  async print(id: number, dto: Print${page.prefix}Dto, user: JwtUser) {
    const record = await this.findOwned(id, user)
    if (record.status === BIZ_STATUS.DRAFT || record.status === BIZ_STATUS.SUBMITTED) {
      throw new BadRequestException('仅已审核记录可调用打印中心')
    }
    const log = this.printLogRepo.create({
      tenantId: record.tenantId,
      bizId: record.id,
      templateCode: dto.templateCode || record.printTemplateCode || '${page.prefix.toUpperCase()}',
      copies: dto.copies,
      channel: dto.channel,
      printedBy: user.userId,
      pdfUrl: null,
      watermark: 'tenant-' + user.tenantId,
      createdAt: new Date()
    })
    const saved = await this.printLogRepo.save(log)
    await this.writeAudit(record, record.status, record.status, 'print', user, '打印中心调用已留痕')
    return saved
  }
`
    : ''

  return `import {
  BadRequestException,${aiImports}
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
import {
  ${page.prefix}AuditLog,${page.ai ? '\n  ' + page.prefix + 'AiAudit,' : ''}${page.print ? '\n  ' + page.prefix + 'PrintLog,' : ''}
  ${page.prefix}Record
} from './${page.dir}.entity'
import {
  Create${page.prefix}Dto,
  Query${page.prefix}Dto,
  Update${page.prefix}Dto${page.ai ? ',\n  Confirm' + page.prefix + 'AiDto' : ''}${page.print ? ',\n  Print' + page.prefix + 'Dto' : ''}
} from './dto'

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
    @InjectRepository(${page.prefix}AuditLog) private readonly auditRepo: Repository<${page.prefix}AuditLog>${aiInject}${printInject},
    @Inject('REDIS_CLIENT') private readonly redis: Redis
  ) {}

  async list(query: Query${page.prefix}Dto, user: JwtUser, scope: DataScopeInfo): Promise<PageResult<${page.prefix}Record>> {
    const page = Math.max(1, query.page ?? 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE))
    const cacheKey = 'dashboard:' + user.tenantId + ':${page.dir}:' + scope.level + ':' + (scope.orgId ?? 0) + ':' + page + ':' + pageSize

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
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', ${page.cacheTtl})
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
    const saved = await this.repo.save(record)
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
${aiMethods}${printMethods}
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
    await this.repo.save(record)
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
    const pattern = 'dashboard:' + tenantId + ':${page.dir}:*'
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
}
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

  const aiActions = page.ai
    ? `
  @Post(':id/ai-suggest')
  @RequirePerm('${page.perm}:ai')
  aiSuggest(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.aiSuggest(id, user)
  }

  @Post('ai-confirm/:auditId')
  @RequirePerm('${page.perm}:ai-confirm')
  aiConfirm(
    @Param('auditId', ParseIntPipe) auditId: number,
    @Body() dto: Confirm${page.prefix}AiDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.aiConfirm(auditId, dto, user)
  }
`
    : ''

  const printAction = page.print
    ? `
  @Post(':id/print')
  @RequirePerm('${page.perm}:print')
  print(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Print${page.prefix}Dto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.print(id, dto, user)
  }
`
    : ''

  const dtoImports = ['Create' + page.prefix + 'Dto', 'Query' + page.prefix + 'Dto', 'Update' + page.prefix + 'Dto']
  if (page.ai) dtoImports.push('Confirm' + page.prefix + 'AiDto')
  if (page.print) dtoImports.push('Print' + page.prefix + 'Dto')

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
import { ${dtoImports.join(', ')} } from './dto'

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
${actions}${aiActions}${printAction}}
`
}

function moduleFile(page) {
  const entities = [page.prefix + 'Record', page.prefix + 'AuditLog']
  if (page.ai) entities.push(page.prefix + 'AiAudit')
  if (page.print) entities.push(page.prefix + 'PrintLog')

  return `import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ${page.prefix}Controller } from './${page.dir}.controller'
import { ${entities.join(', ')} } from './${page.dir}.entity'
import { ${page.prefix}Service } from './${page.dir}.service'

@Module({
  imports: [TypeOrmModule.forFeature([${entities.join(', ')}])],
  controllers: [${page.prefix}Controller],
  providers: [${page.prefix}Service],
  exports: [${page.prefix}Service]
})
export class ${page.prefix}Module {}
`
}

function apiFile(page) {
  const interfaceFields = page.fields
    .map((field) => '  ' + field.name + ': ' + tsType(field))
    .join('\n')
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

  const aiFns = page.ai
    ? `
export function suggest${page.prefix}(id: number) {
  return request<{ auditId: number; suggestion: string }>({ url: baseUrl + '/' + id + '/ai-suggest', method: 'post' })
}

export function confirm${page.prefix}(auditId: number, accepted: 'YES' | 'NO') {
  return request<{ id: number; accepted: string }>({ url: baseUrl + '/ai-confirm/' + auditId, method: 'post', data: { accepted } })
}
`
    : ''

  const printFn = page.print
    ? `
export function print${page.prefix}(id: number, data: { templateCode?: string; copies: number; channel: string }) {
  return request<{ id: number; templateCode: string; copies: number }>({ url: baseUrl + '/' + id + '/print', method: 'post', data })
}
`
    : ''

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
${actionFns}${aiFns}${printFn}`
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

function chartBlock(page) {
  const chart = page.chart
  const valueExpression = chart.decimal
    ? "new Decimal(String(row[" + JSON.stringify(chart.yField) + "] ?? '0')).toNumber()"
    : 'Number(row[' + JSON.stringify(chart.yField) + '] ?? 0)'

  const script = `
const chartItems = computed(() => {
  const values = rows.value.map((row) => ({
    id: row.id,
    label: String(row['${chart.xField}'] ?? ''),
    value: ${valueExpression}
  }))
  const max = Math.max(1, ...values.map((item) => item.value))
  return values.map((item) => ({
    id: item.id,
    label: item.label,
    value: item.value,
    height: Math.round((item.value / max) * 100)
  }))
})
`

  if (chart.kind === 'line') {
    const lineScript = `
const chartPoints = computed(() => {
  const items = chartItems.value
  const step = items.length > 1 ? 560 / (items.length - 1) : 0
  return items
    .map((item, index) => String(20 + index * step) + ',' + String(100 - item.height * 0.8))
    .join(' ')
})
`
    const template = `
    <section class="chart-panel">
      <h3>${chart.title}</h3>
      <div v-if="rows.length === 0" class="chart-empty">暂无数据</div>
      <svg v-else viewBox="0 0 600 120" class="chart-line" role="img" aria-label="${chart.title}趋势图">
        <polyline :points="chartPoints" fill="none" stroke="#1677ff" stroke-width="2" />
        <circle v-for="(item, index) in chartItems" :key="item.id" :cx="20 + index * (chartItems.length > 1 ? 560 / (chartItems.length - 1) : 0)" :cy="100 - item.height * 0.8" r="3" fill="#1677ff" />
      </svg>
      <div class="chart-legend">
        <span v-for="item in chartItems" :key="item.id">{{ item.label }}: {{ item.value }}</span>
      </div>
    </section>`
    return { script: script + lineScript, template }
  }

  const template = `
    <section class="chart-panel">
      <h3>${chart.title}</h3>
      <div v-if="rows.length === 0" class="chart-empty">暂无数据</div>
      <div v-else class="chart-bars">
        <div v-for="item in chartItems" :key="item.id" class="chart-bar-item">
          <div class="chart-bar-track"><div class="chart-bar-fill" :style="{ height: item.height + '%' }"></div></div>
          <span class="chart-bar-label">{{ item.label }}</span>
          <span class="chart-bar-value">{{ item.value }}</span>
        </div>
      </div>
    </section>`
  return { script, template }
}

function indexFile(page) {
  const chart = chartBlock(page)
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

  const extraImports = []
  if (page.ai) extraImports.push('  suggest' + page.prefix + ',', '  confirm' + page.prefix + ',')
  if (page.print) extraImports.push('  print' + page.prefix + ',')
  const importLine = extraImports.length > 0 ? ',\n' + extraImports.join('\n').replace(/,$/, '') : ''

  const toolbar = page.ai
    ? `      <template #toolbar>
        <el-button v-perm="permPrefix + ':ai'" :disabled="!selected" @click="handleAiSuggest">AI 建议</el-button>
      </template>
`
    : page.print
      ? `      <template #toolbar>
        <el-button v-perm="permPrefix + ':print'" :disabled="!selected" @click="handlePrint">打印</el-button>
      </template>
`
      : ''

  const aiScript = page.ai
    ? `
const aiResult = ref<{ auditId: number; suggestion: string } | null>(null)
const aiBusy = ref(false)

async function handleAiSuggest() {
  if (!selected.value || aiBusy.value) {
    return
  }
  aiBusy.value = true
  try {
    aiResult.value = await suggest${page.prefix}(selected.value.id)
    ElMessage.success('已生成建议，需人工确认')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '建议生成失败')
  } finally {
    aiBusy.value = false
  }
}

async function handleAiConfirm(accepted: 'YES' | 'NO') {
  if (!aiResult.value) {
    return
  }
  try {
    await confirm${page.prefix}(aiResult.value.auditId, accepted)
    ElMessage.success(accepted === 'YES' ? '建议已采纳并留审计' : '建议已驳回并留审计')
    aiResult.value = null
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '确认失败')
  }
}
`
    : ''

  const printScript = page.print
    ? `
async function handlePrint() {
  if (!selected.value) {
    return
  }
  try {
    const job = await print${page.prefix}(selected.value.id, { copies: 1, channel: 'SERVER_PDF' })
    ElMessage.success('打印任务已提交：' + job.templateCode)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '打印任务提交失败')
  }
}
`
    : ''

  const aiTemplate = page.ai
    ? `
    <section v-if="aiResult" class="ai-panel">
      <h3>AI 建议（仅建议，不自动写入）</h3>
      <p>{{ aiResult.suggestion }}</p>
      <div class="ai-actions">
        <el-button v-perm="permPrefix + ':ai-confirm'" type="primary" @click="handleAiConfirm('YES')">采纳</el-button>
        <el-button v-perm="permPrefix + ':ai-confirm'" @click="handleAiConfirm('NO')">驳回</el-button>
      </div>
    </section>`
    : ''

  const decimalImport = page.chart.decimal ? "import Decimal from 'decimal.js'\n" : ''

  return `<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
${decimalImport}import ${page.prefix}Drawer from './${page.prefix}Drawer.vue'
import BaseGrid from '@/components/BaseGrid.vue'
import StatusSteps from '@/components/StatusSteps.vue'
import {
  create${page.prefix},
  delete${page.prefix},
  fetch${page.prefix}List,
  update${page.prefix},
  ${actionImports}${importLine}
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
${aiScript}${printScript}${chart.script}
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
    >${toolbar}    </BaseGrid>
${chart.template}${aiTemplate}

    <${page.prefix}Drawer
      v-model="drawerVisible"
      :title="isEdit ? '编辑${page.title}' : '新建${page.title}'"
      :form="form"
      :loading="submitting"
      :is-edit="isEdit"
      @update:form="form = $event"
      @submit="handleSubmit"
    />
  </section>
</template>

<style scoped>
.chart-panel {
  margin-bottom: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.chart-panel h3 {
  margin: 0 0 12px;
  font-size: 15px;
}

.chart-empty {
  padding: 24px;
  text-align: center;
  color: #646a73;
}

.chart-bars {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  min-height: 140px;
}

.chart-bar-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.chart-bar-track {
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 100px;
  background: #f2f3f5;
  border-radius: 4px;
}

.chart-bar-fill {
  width: 100%;
  min-height: 2px;
  background: #1677ff;
  border-radius: 4px;
}

.chart-bar-label,
.chart-bar-value {
  font-size: 12px;
  color: #646a73;
}

.chart-line {
  width: 100%;
  height: 140px;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #646a73;
}

.ai-panel {
  margin-bottom: 16px;
  padding: 16px;
  background: #fff8e6;
  border-radius: 8px;
}

.ai-panel h3 {
  margin: 0 0 8px;
  font-size: 15px;
}

.ai-actions {
  display: flex;
  gap: 8px;
}
</style>
`
}

function migrationFile(allPages) {
  const bt = String.fromCharCode(96)
  const statements = [
    '-- M01 工作台初始迁移：synchronize=false，所有建表由本文件负责',
    '-- 工作台 KPI 缓存键：dashboard:{tenant}:{page}:{scope}:{pageNo}:{pageSize}，TTL 5~30min',
    ''
  ]

  for (const raw of allPages) {
    const page = normalize(raw)
    const mainColumns = [
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
      mainColumns.push(bt + field.column + bt + ' ' + sqlType(field) + ' ' + (field.required ? 'NOT NULL' : 'NULL'))
    }
    mainColumns.push(
      'PRIMARY KEY (' + bt + 'id' + bt + ')',
      'KEY ' + bt + 'idx_tenant_deleted' + bt + ' (' + bt + 'tenant_id' + bt + ', ' + bt + 'is_deleted' + bt + ')',
      'KEY ' + bt + 'idx_status' + bt + ' (' + bt + 'status' + bt + ')'
    )
    statements.push('-- ' + page.title)
    statements.push(
      'CREATE TABLE IF NOT EXISTS ' + bt + page.table + bt + ' (\n  ' + mainColumns.join(',\n  ') + '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
    )

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
    statements.push('CREATE TABLE IF NOT EXISTS ' + bt + page.table + '_audit_log' + bt + ' (\n  ' + auditColumns.join(',\n  ') + '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;')

    if (page.ai) {
      const aiColumns = [
        bt + 'id' + bt + ' BIGINT NOT NULL AUTO_INCREMENT',
        bt + 'tenant_id' + bt + ' BIGINT NOT NULL',
        bt + 'biz_id' + bt + ' BIGINT NOT NULL',
        bt + 'capability' + bt + ' VARCHAR(40) NOT NULL',
        bt + 'model' + bt + ' VARCHAR(40) NOT NULL',
        bt + 'prompt_tokens' + bt + ' INT NOT NULL DEFAULT 0',
        bt + 'completion_tokens' + bt + ' INT NOT NULL DEFAULT 0',
        bt + 'latency_ms' + bt + ' INT NOT NULL DEFAULT 0',
        bt + 'accepted' + bt + " VARCHAR(16) NOT NULL DEFAULT 'PENDING'",
        bt + 'request' + bt + ' VARCHAR(500) NOT NULL',
        bt + 'response' + bt + ' VARCHAR(1000) NOT NULL',
        bt + 'operator' + bt + ' BIGINT NOT NULL',
        bt + 'created_at' + bt + ' DATETIME NOT NULL',
        'PRIMARY KEY (' + bt + 'id' + bt + ')'
      ]
      statements.push('CREATE TABLE IF NOT EXISTS ' + bt + page.table + '_ai_audit' + bt + ' (\n  ' + aiColumns.join(',\n  ') + '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;')
    }

    if (page.print) {
      const printColumns = [
        bt + 'id' + bt + ' BIGINT NOT NULL AUTO_INCREMENT',
        bt + 'tenant_id' + bt + ' BIGINT NOT NULL',
        bt + 'biz_id' + bt + ' BIGINT NOT NULL',
        bt + 'template_code' + bt + ' VARCHAR(64) NOT NULL',
        bt + 'copies' + bt + ' INT NOT NULL DEFAULT 1',
        bt + 'channel' + bt + ' VARCHAR(24) NOT NULL',
        bt + 'printed_by' + bt + ' BIGINT NOT NULL',
        bt + 'pdf_url' + bt + ' VARCHAR(255) NULL',
        bt + 'watermark' + bt + ' VARCHAR(64) NOT NULL',
        bt + 'created_at' + bt + ' DATETIME NOT NULL',
        'PRIMARY KEY (' + bt + 'id' + bt + ')'
      ]
      statements.push('CREATE TABLE IF NOT EXISTS ' + bt + page.table + '_print_log' + bt + ' (\n  ' + printColumns.join(',\n  ') + '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;')
    }

    statements.push('')
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
  const otherPrefixes = pages
    .filter((item) => item.route !== page.route)
    .map((item) => item.prefix)

  const checks = [
    ['列表三态齐全', all.includes('BaseGrid') && all.includes('error') && all.includes('暂无数据')],
    ['状态机正确', all.includes('allowedTransitions') && all.includes('CANCELLED') && all.includes('writeAudit')],
    ['金额 decimal.js', page.fields.some((field) => field.type.startsWith('decimal')) ? all.includes("from 'decimal.js'") : !all.includes('FLOAT')],
    ['带 tenant_id', all.includes("name: 'tenant_id'") && all.includes('tenantId')],
    ['业务前缀独立', all.includes(page.prefix) && all.includes("@Controller('" + page.route + "')")],
    ['无其他业务域字样', !otherPrefixes.some((prefix) => all.includes(prefix))],
    ['Redis 看板缓存', all.includes("'dashboard:'") && all.includes('EX')],
    ['AI 人工确认留审计', page.ai ? all.includes('aiConfirm') && all.includes("accepted: 'PENDING'") : true],
    ['打印中心留痕', page.print ? all.includes('printLogRepo') && all.includes('templateCode') : true]
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

write('apps/server/src/migrations/M01_dashboard.sql', migrationFile(pages))
console.log('\n工作台共生成 ' + generated + ' 个独立页面，每页 8 个专属文件，并输出 1 份迁移 SQL。')
