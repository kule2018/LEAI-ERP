import { Injectable } from '@nestjs/common'
import { PERMISSION_CODES } from '../platform/platform-seeder.service'

export interface ApiEndpointDoc {
  method: string
  path: string
  perm: string
  description: string
}

export interface ApiGroupDoc {
  module: string
  description: string
  endpoints: ApiEndpointDoc[]
}

@Injectable()
export class DocsService {
  private readonly groups: ApiGroupDoc[] = [
    {
      module: '工作台',
      description: '角色 KPI、KPI 下钻、销售趋势、13 周现金流、订阅推送与经营简报。',
      endpoints: [
        { method: 'GET', path: '/api/v1/workbench/overview', perm: 'dashboard:view', description: '工作台总览（角色 KPI、异常预警、AI 日报）' },
        { method: 'GET', path: '/api/v1/workbench/kpis', perm: 'dashboard:view', description: '按角色可见 KPI 配置' },
        { method: 'POST', path: '/api/v1/workbench/kpis', perm: 'workbench:kpi:update', description: '新增或覆盖 KPI 配置' },
        { method: 'GET', path: '/api/v1/workbench/drill/:code', perm: 'dashboard:view', description: 'KPI 下钻明细（受数据权限约束）' },
        { method: 'GET', path: '/api/v1/workbench/sales-trend', perm: 'dashboard:view', description: '销售趋势（同环比、毛利、贡献度、排行）' },
        { method: 'GET', path: '/api/v1/workbench/cash-flow', perm: 'dashboard:view', description: '13 周现金流预测与情景模拟' },
        { method: 'GET', path: '/api/v1/workbench/briefings', perm: 'workbench:briefing:view', description: '经营简报列表' },
        { method: 'POST', path: '/api/v1/workbench/briefings', perm: 'workbench:briefing:create', description: '按周报/月报模板生成简报' },
        { method: 'POST', path: '/api/v1/workbench/briefings/:id/publish', perm: 'workbench:briefing:publish', description: '发布简报并生成 PDF 内容' },
        { method: 'POST', path: '/api/v1/workbench/briefings/:id/read', perm: 'workbench:briefing:view', description: '简报阅读确认' },
        { method: 'POST', path: '/api/v1/workbench/subscriptions', perm: 'workbench:subscription:update', description: '订阅推送配置' }
      ]
    },
    {
      module: '认证与平台',
      description: '登录、刷新、动态菜单、组织权限、字典编码、审计通知文件。',
      endpoints: [
        { method: 'POST', path: '/api/v1/auth/login', perm: '公开', description: '登录并返回 Token、菜单' },
        { method: 'POST', path: '/api/v1/auth/refresh', perm: '公开', description: '刷新访问令牌' },
        { method: 'GET', path: '/api/v1/auth/menus', perm: '认证', description: '动态菜单树' },
        { method: 'GET', path: '/api/v1/system/audit', perm: 'system:audit:view', description: '审计日志检索' },
        { method: 'GET', path: '/api/v1/system/dict/options/:dictType', perm: 'system:dict:view', description: '字典选项' },
        { method: 'POST', path: '/api/v1/system/sequence/next', perm: 'system:sequence:next', description: '生成下一编码' }
      ]
    },
    {
      module: '销售客户',
      description: '客户、线索、商机、报价、合同、销售单、发货、退货、对账。',
      endpoints: [
        { method: 'GET', path: '/api/v1/sales/customers', perm: 'sales:customer:view', description: '客户列表' },
        { method: 'POST', path: '/api/v1/sales/orders', perm: 'sales:order:create', description: '创建销售单' },
        { method: 'POST', path: '/api/v1/sales/orders/:id/approve', perm: 'sales:order:approve', description: '审批销售单' },
        { method: 'POST', path: '/api/v1/sales/shipments', perm: 'sales:shipment:create', description: '发货并扣减库存' }
      ]
    },
    {
      module: '采购供应',
      description: '供应商、询价、采购单、收货、对账、委外加工、供应商门户。',
      endpoints: [
        { method: 'POST', path: '/api/v1/purchase/orders', perm: 'purchase:order:create', description: '创建采购单' },
        { method: 'POST', path: '/api/v1/purchase/receipts', perm: 'purchase:receipt:create', description: '创建收货单' },
        { method: 'POST', path: '/api/v1/purchase/outsource-orders', perm: 'purchase:order:create', description: '创建委外单' },
        { method: 'POST', path: '/api/v1/purchase/outsource-orders/:id/issue', perm: 'purchase:order:update', description: '委外发料或退料' },
        { method: 'GET', path: '/api/v1/purchase/portal/summary', perm: 'purchase:supplier:view', description: '供应商门户汇总' },
        { method: 'GET', path: '/api/v1/purchase/supplier-extensions/qualification-alerts', perm: 'purchase:supplier:view', description: '供应商资质到期预警' },
        { method: 'POST', path: '/api/v1/purchase/supplier-extensions/bank-accounts', perm: 'purchase:supplier:bank', description: '供应商银行账户校验登记' },
        { method: 'GET', path: '/api/v1/purchase/supplier-extensions/radar/:supplierId', perm: 'purchase:supplier:view', description: '供应商评级雷达' },
        { method: 'POST', path: '/api/v1/purchase/awards/compare', perm: 'purchase:inquiry:compare', description: '询价多轮自动比价评分' },
        { method: 'POST', path: '/api/v1/purchase/awards/:id/approve', perm: 'purchase:inquiry:approve', description: '授标审批' },
        { method: 'POST', path: '/api/v1/purchase/order-extensions/demands/merge', perm: 'purchase:demand:merge', description: '采购需求合并' },
        { method: 'POST', path: '/api/v1/purchase/order-extensions/demands/convert', perm: 'purchase:demand:convert', description: '需求转采购订单（预算校验）' },
        { method: 'POST', path: '/api/v1/purchase/order-extensions/:id/changes', perm: 'purchase:order:change', description: '采购订单变更版本留痕' },
        { method: 'GET', path: '/api/v1/purchase/order-extensions/:id/progress', perm: 'purchase:order:view', description: '到货计划进度与逾期跟踪' },
        { method: 'POST', path: '/api/v1/purchase/receipt-extensions/scan', perm: 'purchase:receipt:scan', description: '扫码收货' },
        { method: 'POST', path: '/api/v1/purchase/receipt-extensions/:id/difference', perm: 'purchase:receipt:difference', description: '差异收货登记' },
        { method: 'POST', path: '/api/v1/purchase/receipt-extensions/:id/estimate/reverse', perm: 'purchase:estimate:reverse', description: '暂估冲销' },
        { method: 'POST', path: '/api/v1/purchase/receipt-extensions/:id/cost-allocations', perm: 'purchase:cost:allocate', description: '采购成本分摊' },
        { method: 'GET', path: '/api/v1/purchase/statement-extensions/:id/difference', perm: 'purchase:statement:difference', description: '对账三方差异分析' },
        { method: 'POST', path: '/api/v1/purchase/statement-extensions/:id/reverse', perm: 'purchase:statement:reverse', description: '对账红冲' },
        { method: 'POST', path: '/api/v1/purchase/outsource-extensions/losses', perm: 'purchase:outsource:view', description: '委外损耗申报' },
        { method: 'POST', path: '/api/v1/purchase/outsource-extensions/:id/settle', perm: 'purchase:outsource:settle', description: '委外结算生成对账单' },
        { method: 'POST', path: '/api/v1/purchase/logistics-extensions/waybills/:waybillId/track-nodes', perm: 'purchase:logistics:track', description: '物流轨迹登记' },
        { method: 'POST', path: '/api/v1/purchase/logistics-extensions/waybills/:waybillId/freight-reconcile', perm: 'purchase:logistics:reconcile', description: '运费对账' },
        { method: 'POST', path: '/api/v1/purchase/price-extensions/resolve', perm: 'purchase:price:view', description: '采购自动取价' },
        { method: 'GET', path: '/api/v1/purchase/price-extensions/matrix', perm: 'purchase:price:view', description: '采购价目表矩阵' },
        { method: 'GET', path: '/api/v1/purchase/price-extensions/performance', perm: 'purchase:report:view', description: '采购绩效及时率合格率分析' },
        { method: 'POST', path: '/api/v1/purchase/price-extensions/portal/shipments', perm: 'purchase:portal:write', description: '供应商门户发货通知' }
      ]
    },
    {
      module: '库存仓储',
      description: '余额、流水、锁定、冻结、盘点、调拨、波次拣货。',
      endpoints: [
        { method: 'GET', path: '/api/v1/inventory/balances', perm: 'inventory:balance:view', description: '库存余额查询' },
        { method: 'POST', path: '/api/v1/inventory/movements', perm: 'inventory:inout:create', description: '库存出入库流水' },
        { method: 'POST', path: '/api/v1/inventory/locks', perm: 'inventory:balance:update', description: '库存锁定' },
        { method: 'POST', path: '/api/v1/inventory/waves/:id/tasks/:taskId/pick', perm: 'inventory:wave:pick', description: '拣货' }
      ]
    },
    {
      module: '财务结算',
      description: '科目、凭证、应收应付、收付款、报表与月结。',
      endpoints: [
        { method: 'POST', path: '/api/v1/finance/vouchers', perm: 'finance:voucher:create', description: '创建凭证' },
        { method: 'POST', path: '/api/v1/finance/vouchers/:id/post', perm: 'finance:voucher:post', description: '过账凭证' },
        { method: 'GET', path: '/api/v1/finance/receivables', perm: 'finance:receivable:view', description: '应收列表' },
        { method: 'POST', path: '/api/v1/finance/receipts', perm: 'finance:receipt:create', description: '收款单' }
      ]
    },
    {
      module: '生产制造',
      description: 'BOM、工艺、MRP、工单、领料退料、质检。',
      endpoints: [
        { method: 'POST', path: '/api/v1/mfg/mrp/run', perm: 'mfg:mrp:run', description: '运行 MRP' },
        { method: 'POST', path: '/api/v1/mfg/work-orders', perm: 'mfg:workorder:create', description: '创建工单' },
        { method: 'POST', path: '/api/v1/mfg/work-orders/:id/issue', perm: 'mfg:workorder:update', description: '领料或退料' },
        { method: 'POST', path: '/api/v1/mfg/work-orders/:id/complete', perm: 'mfg:workorder:update', description: '完工入库' }
      ]
    },
    {
      module: '商城与集成',
      description: '店铺、商品映射、订单同步、支付、物流、客服、开放平台。',
      endpoints: [
        { method: 'POST', path: '/api/v1/shop/orders/sync', perm: 'shop:order:sync', description: '同步平台订单' },
        { method: 'POST', path: '/api/v1/shop/orders/:id/ship', perm: 'shop:order:ship', description: '商城订单发货' },
        { method: 'POST', path: '/api/v1/openapi/keys', perm: 'system:openapi:create', description: '创建 API Key' },
        { method: 'POST', path: '/api/v1/openapi/events/publish', perm: 'system:openapi:create', description: '发布业务事件' }
      ]
    },
    {
      module: '打印与 AI',
      description: '模板、任务、记录、标签、Copilot、OCR、预测、异常、RAG。',
      endpoints: [
        { method: 'POST', path: '/api/v1/print/jobs', perm: 'print:job:create', description: '创建打印任务' },
        { method: 'GET', path: '/api/v1/print/records/:id/html', perm: 'print:record:view', description: '打印 HTML / 导出 PDF' },
        { method: 'POST', path: '/api/v1/ai/copilot', perm: 'ai:chat', description: 'AI Copilot' },
        { method: 'POST', path: '/api/v1/ai/ocr', perm: 'ai:ocr', description: 'OCR 结构化识别' },
        { method: 'POST', path: '/api/v1/ai/rag/query', perm: 'ai:rag', description: '知识库溯源问答' }
      ]
    },
    {
      module: '协同审批',
      description: '流程定义、会签/或签、加签转办、超时升级、流程图追踪。',
      endpoints: [
        { method: 'POST', path: '/api/v1/collab/flows/definitions', perm: 'flow:define:create', description: '创建流程定义（支持审批模式/超时）' },
        { method: 'POST', path: '/api/v1/collab/flows/start', perm: 'flow:start', description: '发起流程（固化流程快照）' },
        { method: 'POST', path: '/api/v1/collab/flows/tasks/:id/act', perm: 'flow:todo:approve', description: '审批，驳回必须填原因' },
        { method: 'POST', path: '/api/v1/collab/flows/tasks/:id/delegate', perm: 'flow:todo:approve', description: '转办/委托' },
        { method: 'POST', path: '/api/v1/collab/flows/tasks/:id/add-sign', perm: 'flow:todo:approve', description: '加签' },
        { method: 'GET', path: '/api/v1/collab/flows/instances/:id', perm: 'flow:monitor:view', description: '流程详情与流程图追踪' },
        { method: 'POST', path: '/api/v1/collab/flows/escalate', perm: 'flow:monitor:view', description: '超时升级扫描' },
        { method: 'POST', path: '/api/v1/sales/orders/:id/submit', perm: 'sales:order:submit', description: '提交销售单（配置 sale_order 流程时自动发起审批流）' }
      ]
    },
    {
      module: '运维监控',
      description: '健康检查、指标、限流、备份恢复。',
      endpoints: [
        { method: 'GET', path: '/api/v1/health', perm: '公开', description: '数据库与 Redis 健康检查' },
        { method: 'GET', path: '/api/v1/metrics', perm: '公开', description: '进程与请求指标 JSON' },
        { method: 'GET', path: '/api/v1/metrics/prometheus', perm: '公开', description: 'Prometheus 文本指标' },
        { method: 'POST', path: '/api/v1/integration/todos/:channel', perm: 'system:integration:create', description: '企微/钉钉待办推送' },
        { method: 'GET', path: '/api/v1/system/features', perm: 'system:feature:view', description: '功能开关列表' },
        { method: 'GET', path: '/api/v1/system/io/configs', perm: 'system:io:view', description: '导入资源列表' },
        { method: 'GET', path: '/api/v1/system/io/template/:code', perm: 'system:io:view', description: '下载 CSV 导入模板' },
        { method: 'POST', path: '/api/v1/system/io/preview', perm: 'system:io:import', description: '导入校验预览，错误行不落库' },
        { method: 'POST', path: '/api/v1/system/io/import', perm: 'system:io:import', description: '事务导入，错误整批不落库' },
        { method: 'POST', path: '/api/v1/system/io/export', perm: 'system:io:export', description: '创建异步导出任务' },
        { method: 'GET', path: '/api/v1/system/io/jobs', perm: 'system:io:view', description: '导入导出任务列表' },
        { method: 'POST', path: '/api/v1/finance/vouchers/:id/unpost', perm: 'finance:voucher:reverse', description: '凭证反审核' },
        { method: 'GET', path: '/api/v1/mfg/work-orders/:id/kitting', perm: 'mfg:work-order:view', description: '工单齐套检查' },
        { method: 'GET', path: '/api/v1/purchase/receipts/:id/match', perm: 'purchase:receipt:view', description: '采购订单/收货/发票三方匹配' },
        { method: 'POST', path: '/api/v1/inventory/transfers/:id/submit', perm: 'inventory:transfer:create', description: '调拨发货（形成在途库存）' },
        { method: 'GET', path: '/api/v1/inventory/ledger/trace/:batchNo', perm: 'inventory:ledger:view', description: '批次正反向追溯与召回清单' },
        { method: 'POST', path: '/api/v1/risk/scan', perm: 'risk:scan', description: '扫描五类业务风险' },
        { method: 'POST', path: '/api/v1/inventory/stocktakes/:id/recount', perm: 'inventory:stocktake:approve', description: '盲盘复盘' },
        { method: 'GET', path: '/api/v1/mfg/boms/:id/cost', perm: 'mfg:bom:view', description: 'BOM 成本卷算' },
        { method: 'POST', path: '/api/v1/sales/returns/:id/qc', perm: 'sales:return:update', description: '退货质检' },
        { method: 'POST', path: '/api/v1/sales/returns/:id/approve', perm: 'sales:return:approve', description: '退货审批（退款+回补库存+红字发票）' },
        { method: 'GET', path: '/api/v1/mfg/qc/sampling/:lotQty', perm: 'mfg:qc:view', description: '质检抽样建议' },
        { method: 'POST', path: '/api/v1/mfg/qc/:id/concession', perm: 'mfg:qc:approve', description: '让步接收审批（解冻库存）' },
        { method: 'POST', path: '/api/v1/finance/accounts/:id/reconcile', perm: 'finance:account:update', description: '资金账户余额调节' },
        { method: 'POST', path: '/api/v1/finance/invoices/:id/match', perm: 'finance:invoice:view', description: '发票认证勾稽' },
        { method: 'GET', path: '/api/v1/finance/periods/checks/:period', perm: 'finance:period:view', description: '月结检查清单' },
        { method: 'POST', path: '/api/v1/mfg/equipment/:id/inspect', perm: 'mfg:equipment:update', description: '设备点检（自动计算 OEE）' },
        { method: 'GET', path: '/api/v1/mfg/equipment/maintenance-alerts', perm: 'mfg:equipment:view', description: '保养到期提醒' },
        { method: 'POST', path: '/api/v1/finance/assets/:id/stocktake', perm: 'finance:asset:update', description: '固定资产盘点' },
        { method: 'POST', path: '/api/v1/finance/assets/:id/dispose', perm: 'finance:asset:update', description: '固定资产处置' },
        { method: 'POST', path: '/api/v1/finance/costs/recalculate', perm: 'finance:cost:create', description: '创建成本重算任务' },
        { method: 'POST', path: '/api/v1/system/notify/templates', perm: 'system:notify:create', description: '创建通知模板' },
        { method: 'GET', path: '/api/v1/system/notify/templates', perm: 'system:notify:view', description: '通知模板列表' },
        { method: 'POST', path: '/api/v1/system/notify/send/:code', perm: 'system:notify:create', description: '按模板多渠道发送' },
        { method: 'POST', path: '/api/v1/system/notify/:id/retry', perm: 'system:notify:update', description: '失败通知重试' },
        { method: 'GET', path: '/api/v1/system/scheduler', perm: 'system:monitor:view', description: '定时任务列表与执行日志' },
        { method: 'POST', path: '/api/v1/system/scheduler/:code/run', perm: 'system:monitor:update', description: '手动执行定时任务' },
        { method: 'GET', path: '/api/v1/metrics/slow', perm: 'system:monitor:view', description: '慢请求列表' },
        { method: 'GET', path: '/api/v1/metrics/alerts', perm: 'system:monitor:view', description: '监控告警列表' },
        { method: 'POST', path: '/api/v1/finance/accounts/:id/transactions/import', perm: 'finance:account:update', description: '资金流水导入（外部流水号去重）' },
        { method: 'POST', path: '/api/v1/purchase/suppliers/admission/:supplierId', perm: 'purchase:supplier:update', description: '供应商准入审批' },
        { method: 'POST', path: '/api/v1/mfg/boms/items/:itemId/substitute', perm: 'mfg:bom:view', description: '替代料解析' },
        { method: 'GET', path: '/api/v1/mfg/routing/effective/:productId', perm: 'mfg:routing:view', description: '按日期取生效工艺版本' },
        { method: 'GET', path: '/api/v1/system/sequence/preview/:bizCode', perm: 'system:sequence:view', description: '编码规则预览（不消耗序号）' },
        { method: 'GET', path: '/api/v1/system/audit/export', perm: 'system:audit:view', description: '审计日志导出（脱敏）' },
        { method: 'GET', path: '/api/v1/system/io/jobs/:id/content', perm: 'system:io:view', description: '异步导出内容下载' },
        { method: 'POST', path: '/api/v1/system/io/jobs/process', perm: 'system:io:export', description: '手动处理导出任务' },
        { method: 'GET', path: '/api/v1/system/openapi/call-logs', perm: 'system:openapi:view', description: 'OpenAPI 调用日志' },
        { method: 'POST', path: '/api/v1/currency/rates', perm: 'system:currency:update', description: '设置汇率（变动超 5% 需原因）' },
        { method: 'POST', path: '/api/v1/currency/convert', perm: 'system:currency:view', description: '按生效日期换算金额' },
        { method: 'POST', path: '/api/v1/currency/to-base', perm: 'system:currency:view', description: '多币种汇总到本位币' },
        { method: 'POST', path: '/api/v1/print/jobs/batch', perm: 'print:job:create', description: '批量打印' },
        { method: 'POST', path: '/api/v1/print/records/:id/reprint', perm: 'print:record:reprint', description: '补打（独立水印与审计）' },
        { method: 'GET', path: '/api/v1/print/templates/versions/:code', perm: 'print:template:view', description: '模板版本时间线' },
        { method: 'POST', path: '/api/v1/print/templates/:id/rollback', perm: 'print:template:update', description: '模板版本回滚' },
        { method: 'GET', path: '/api/v1/shop/stores/auth-expiry-alerts', perm: 'shop:store:view', description: '店铺授权到期预警' },
        { method: 'GET', path: '/api/v1/system/features/:id/impact', perm: 'system:feature:view', description: '功能开关变更影响提示' },
        { method: 'POST', path: '/api/v1/metrics/alerts/:type/ack', perm: 'system:monitor:update', description: '告警确认' },
        { method: 'POST', path: '/api/v1/shop/orders/:id/retry', perm: 'shop:order:sync', description: '商城订单同步失败重试' },
        { method: 'POST', path: '/api/v1/shop/orders/retry-batch', perm: 'shop:order:sync', description: '批量重试失败订单' },
        { method: 'POST', path: '/api/v1/shop/promotions/coupons', perm: 'shop:promotion:create', description: '创建优惠券（门槛/叠加/折扣上限）' },
        { method: 'POST', path: '/api/v1/shop/promotions/coupons/validate', perm: 'shop:promotion:view', description: '校验优惠券可用性' },
        { method: 'POST', path: '/api/v1/shop/promotions/seckills', perm: 'shop:promotion:create', description: '创建秒杀活动（时段与限购）' },
        { method: 'POST', path: '/api/v1/shop/promotions/activity-stock', perm: 'shop:promotion:stock', description: '设置活动独立库存' },
        { method: 'POST', path: '/api/v1/shop/promotions/activity-stock/reserve', perm: 'shop:promotion:stock', description: '预留活动库存（超卖拦截）' },
        { method: 'GET', path: '/api/v1/shop/promotions/effect', perm: 'shop:promotion:effect', description: '促销效果与超卖拦截统计' },
        { method: 'POST', path: '/api/v1/shop/reconciliation/bills/import', perm: 'shop:payment:reconcile', description: '导入平台对账单并自动识别差异' },
        { method: 'POST', path: '/api/v1/shop/reconciliation/bills/:id/resolve', perm: 'shop:payment:reconcile', description: '对账差异处理留痕' },
        { method: 'POST', path: '/api/v1/shop/refunds', perm: 'shop:refund:create', description: '提交商城退款申请' },
        { method: 'POST', path: '/api/v1/shop/refunds/:id/approve', perm: 'shop:refund:approve', description: '退款审批并生成销售退货与红字凭证' },
        { method: 'POST', path: '/api/v1/shop/refunds/:id/reject', perm: 'shop:refund:approve', description: '退款驳回' },
        { method: 'POST', path: '/api/v1/shop/waybills/:id/tracking', perm: 'shop:logistics:update', description: '推送物流轨迹并检测滞留异常' },
        { method: 'GET', path: '/api/v1/shop/waybills/:id/tracking', perm: 'shop:logistics:view', description: '查询物流轨迹' },
        { method: 'POST', path: '/api/v1/shop/cs/:id/quality', perm: 'shop:cs:qc', description: '客服会话质检评分' },
        { method: 'GET', path: '/api/v1/shop/cs/quality-reviews', perm: 'shop:cs:qc', description: '客服质检记录' },
        { method: 'POST', path: '/api/v1/print/templates/:id/publish', perm: 'print:template:update', description: '打印模板发布校验（循环区/字段绑定/LOGO/码图）' },
        { method: 'POST', path: '/api/v1/print/templates/:id/copy', perm: 'print:template:create', description: '复制打印模板为新草稿版本' },
        { method: 'GET', path: '/api/v1/system/data-scope/preview/:bizType', perm: 'system:data-scope:view', description: '预览按单据类型解析的数据权限规则' },
        { method: 'POST', path: '/api/v1/shop/orders/:id/waybill/generate', perm: 'shop:order:ship', description: '按承运商生成电子面单号与标签' },
        { method: 'GET', path: '/api/v1/shop/promotions/calendar', perm: 'shop:promotion:view', description: '营销活动日历' },
        { method: 'POST', path: '/api/v1/shop/cs/quick-replies', perm: 'shop:cs:reply', description: '客服快捷回复推荐' },
        { method: 'POST', path: '/api/v1/shop/goods-maps/:id/sync', perm: 'shop:goods:update', description: '商品映射同步校验' },
        { method: 'POST', path: '/api/v1/shop/goods-maps/retry-failed', perm: 'shop:goods:update', description: '失败商品映射重试' },
        { method: 'GET', path: '/api/v1/sales/statements/collection-plan', perm: 'sales:statement:view', description: '收账台收款计划与逾期分级' },
        { method: 'GET', path: '/api/v1/sales/statements/:id/writeoff-suggestion', perm: 'sales:statement:view', description: '智能核销建议' },
        { method: 'POST', path: '/api/v1/sales/statements/:id/collection-letter', perm: 'sales:statement:settle', description: '催收函生成' },
        { method: 'POST', path: '/api/v1/sales/leads/:id/smart-assign', perm: 'sales:lead:update', description: '线索评分与自动分配' },
        { method: 'GET', path: '/api/v1/sales/leads/:id/duplicates', perm: 'sales:lead:view', description: '重复线索检测' },
        { method: 'POST', path: '/api/v1/sales/opportunities/:id/advance', perm: 'sales:opportunity:update', description: '商机阶段门禁推进' },
        { method: 'POST', path: '/api/v1/sales/quotations/:id/approve', perm: 'sales:quotation:update', description: '报价单审批' },
        { method: 'POST', path: '/api/v1/sales/quotations/:id/convert', perm: 'sales:quotation:convert', description: '报价单转销售单' },
        { method: 'POST', path: '/api/v1/sales/customer-merges', perm: 'sales:customer:merge', description: '客户合并申请与冲突检测' },
        { method: 'POST', path: '/api/v1/sales/pos-hang', perm: 'sales:pos:hang', description: 'POS 幂等挂单与恢复' },
        { method: 'POST', path: '/api/v1/hr/employee-records', perm: 'hr:extension:update', description: '员工合同/异动/证照/组织历史记录' },
        { method: 'POST', path: '/api/v1/hr/offers', perm: 'hr:extension:update', description: 'Offer 预算审批' },
        { method: 'POST', path: '/api/v1/hr/payroll-details', perm: 'hr:extension:update', description: '薪酬社保个税测算与工资条' },
        { method: 'POST', path: '/api/v1/hr/performance-reviews', perm: 'hr:extension:update', description: '绩效 KPI/360/校准与申诉' },
        { method: 'POST', path: '/api/v1/hr/training-records', perm: 'hr:extension:update', description: '培训考试与证书发放' },
        { method: 'POST', path: '/api/v1/hr/asset-actions', perm: 'hr:extension:update', description: '行政资产领用/归还/盘点/维修流水' },
        { method: 'POST', path: '/api/v1/ai/file/parse', perm: 'ai:doc:parse', description: 'PDF/图片/Excel 文本解析' },
        { method: 'POST', path: '/api/v1/ai/ocr/rerecognize', perm: 'ai:ocr', description: 'OCR 人工修正重识别' },
        { method: 'POST', path: '/api/v1/ai/models/gray-select', perm: 'ai:model:view', description: '模型灰度分流选择' },
        { method: 'POST', path: '/api/v1/ai/report/export', perm: 'ai:report', description: 'AI 报表快照导出' },
        { method: 'POST', path: '/api/v1/ai/report/drill', perm: 'ai:report', description: 'AI 报表归因下钻' },
        { method: 'GET', path: '/api/v1/ai/anomalies', perm: 'ai:anomaly', description: 'AI 异常列表' },
        { method: 'POST', path: '/api/v1/ai/anomalies/:id/assign', perm: 'ai:anomaly', description: 'AI 异常指派' },
        { method: 'POST', path: '/api/v1/ai/anomalies/:id/close', perm: 'ai:anomaly', description: 'AI 异常关闭（留处理说明）' }
      ]
    }
  ]

  listApi(): ApiGroupDoc[] {
    return this.groups
  }

  listPermissions(): string[] {
    return [...PERMISSION_CODES].sort()
  }
}
