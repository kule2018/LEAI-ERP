import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { env } from '../../config/env'
import { hashPassword } from '../../common/utils/password.util'
import { MenuEntity } from './entities/menu.entity'
import { PermissionEntity } from './entities/permission.entity'
import { RoleEntity } from './entities/role.entity'
import { RolePermissionEntity } from './entities/role-permission.entity'
import { TenantEntity } from './entities/tenant.entity'
import { UserEntity } from './entities/user.entity'
import { UserRoleEntity } from './entities/user-role.entity'
import { PrintTemplateEntity } from '../print/entities/print-template.entity'
import { AccountSubjectEntity } from '../finance/entities/finance.entities'

interface MenuSeed {
  parentRoute: string | null
  routePath: string
  menuName: string
  componentPath: string | null
  icon: string
  permCode: string | null
  sortNo: number
}

export const PERMISSION_CODES = [
  '*:*',
  'dashboard:view',
  'workbench:kpi:update',
  'workbench:briefing:view',
  'workbench:briefing:create',
  'workbench:briefing:publish',
  'workbench:subscription:update',
  'sales:customer:view',
  'sales:customer:create',
  'sales:customer:update',
  'sales:customer:delete',
  'sales:customer:profile',
  'sales:churn:view',
  'sales:churn:handle',
  'sales:lead:view',
  'sales:lead:create',
  'sales:lead:update',
  'sales:lead:convert',
  'sales:opportunity:view',
  'sales:opportunity:create',
  'sales:opportunity:update',
  'sales:quotation:view',
  'sales:quotation:create',
  'sales:quotation:update',
  'sales:quotation:convert',
  'sales:quotation:version',
  'sales:customer:merge',
  'sales:customer:sensitive',
  'sales:pos:hang',
  'sales:contract:view',
  'sales:contract:create',
  'sales:contract:update',
  'sales:contract:renew',
  'sales:contract:sign',
  'sales:clause:view',
  'sales:clause:manage',
  'sales:order:view',
  'sales:order:create',
  'sales:order:update',
  'sales:order:submit',
  'sales:order:approve',
  'sales:pos:create',
  'sales:pos:pay',
  'sales:pos:member-price',
  'sales:pos:shift',
  'sales:pos:shift:approve',
  'sales:promotion:bundle',
  'sales:statement:view',
  'sales:statement:create',
  'sales:statement:settle',
  'sales:statement:reverse',
  'sales:statement:analysis',
  'sales:price:override',
  'sales:shipment:view',
  'sales:shipment:create',
  'sales:shipment:update',
  'sales:shipment:tracking',
  'sales:shipment:exception',
  'sales:return:view',
  'sales:return:create',
  'sales:return:update',
  'sales:return:approve',
  'sales:return:red-invoice',
  'sales:return:exchange',
  'sales:price:view',
  'sales:price:create',
  'sales:target:view',
  'sales:target:create',
  'sales:target:update',
  'sales:report:view',
  'sales:commission:view',
  'sales:commission:manage',
  'sales:commission:calculate',
  'sales:commission:confirm',
  'sales:commission:pay',
  'sales:complaint:view',
  'sales:complaint:create',
  'sales:complaint:handle',
  'sales:visit:view',
  'sales:visit:create',
  'purchase:supplier:view',
  'purchase:supplier:create',
  'purchase:supplier:update',
  'purchase:supplier:delete',
  'purchase:inquiry:view',
  'purchase:inquiry:create',
  'purchase:inquiry:update',
  'purchase:inquiry:approve',
  'purchase:demand:view',
  'purchase:demand:create',
  'purchase:crossdock:view',
  'purchase:crossdock:create',
  'purchase:fine:view',
  'purchase:fine:create',
  'purchase:fine:approve',
  'purchase:order:view',
  'purchase:order:create',
  'purchase:order:update',
  'purchase:order:submit',
  'purchase:order:approve',
  'purchase:receipt:view',
  'purchase:receipt:create',
  'purchase:receipt:update',
  'purchase:statement:view',
  'purchase:statement:create',
  'purchase:statement:settle',
  'purchase:return:view',
  'purchase:return:create',
  'purchase:contract:view',
  'purchase:contract:create',
  'purchase:price:view',
  'purchase:price:create',
  'purchase:logistics:view',
  'purchase:logistics:create',
  'purchase:report:view',
  'purchase:supplier:qualification',
  'purchase:supplier:bank',
  'purchase:inquiry:compare',
  'purchase:demand:merge',
  'purchase:demand:convert',
  'purchase:order:change',
  'purchase:receipt:scan',
  'purchase:receipt:difference',
  'purchase:estimate:reverse',
  'purchase:cost:allocate',
  'purchase:statement:difference',
  'purchase:statement:reverse',
  'purchase:price:approve',
  'purchase:outsource:view',
  'purchase:outsource:approve',
  'purchase:outsource:settle',
  'purchase:logistics:track',
  'purchase:logistics:reconcile',
  'purchase:portal:write',
  'purchase:portal:manage',
  'purchase:match:view',
  'purchase:frame:view',
  'purchase:blacklist:view',
  'inventory:product:view',
  'inventory:product:create',
  'inventory:product:update',
  'inventory:product:delete',
  'inventory:warehouse:view',
  'inventory:warehouse:create',
  'inventory:warehouse:update',
  'inventory:warehouse:delete',
  'inventory:balance:view',
  'inventory:balance:update',
  'inventory:ledger:view',
  'inventory:ledger:export',
  'inventory:trace:view',
  'inventory:inout:create',
  'inventory:io-doc:view',
  'inventory:io-doc:create',
  'inventory:io-doc:post',
  'inventory:io-doc:reverse',
  'inventory:alert:view',
  'inventory:alert:create',
  'inventory:alert:update',
  'inventory:stocktake:view',
  'inventory:stocktake:create',
  'inventory:stocktake:approve',
  'inventory:adjustment:view',
  'inventory:adjustment:create',
  'inventory:adjustment:post',
  'inventory:transfer:view',
  'inventory:transfer:create',
  'inventory:transfer:receive',
  'inventory:putaway:view',
  'inventory:putaway:create',
  'inventory:putaway:update',
  'inventory:wave:view',
  'inventory:wave:create',
  'inventory:wave:pick',
  'inventory:wave:complete',
  'inventory:wave:review',
  'inventory:assembly:view',
  'inventory:assembly:create',
  'inventory:assembly:approve',
  'inventory:report:view',
  'inventory:negative:view',
  'inventory:negative:allow',
  'inventory:costing:view',
  'inventory:costing:manage',
  'mfg:bom:view',
  'mfg:bom:create',
  'mfg:bom:approve',
  'mfg:routing:view',
  'mfg:routing:create',
  'mfg:mrp:view',
  'mfg:mrp:run',
  'mfg:plan:view',
  'mfg:plan:create',
  'mfg:plan:update',
  'mfg:plan:delete',
  'mfg:work-order:view',
  'mfg:work-order:create',
  'mfg:work-order:update',
  'mfg:work-order:submit',
  'mfg:work-order:approve',
  'mfg:issue:create',
  'mfg:report:create',
  'mfg:complete:create',
  'mfg:qc:view',
  'mfg:qc:create',
  'mfg:qc:approve',
  'mfg:equipment:view',
  'mfg:equipment:create',
  'mfg:equipment:update',
  'mfg:exception:view',
  'mfg:exception:create',
  'mfg:exception:close',
  'mfg:report:view',
  'mfg:return:view',
  'mfg:return:create',
  'mfg:return:post',
  'mfg:demand:view',
  'mfg:bom:change',
  'mfg:schedule:view',
  'mfg:schedule:lock',
  'mfg:schedule:reschedule',
  'mfg:changeover:view',
  'mfg:changeover:manage',
  'mfg:work-order:split',
  'mfg:work-order:change',
  'mfg:issue:over-approve',
  'mfg:equipment:fault',
  'mfg:equipment:maintenance',
  'mfg:report:analysis',
  'mfg:mrp:simulate',
  'finance:subject:view',
  'finance:subject:create',
  'finance:subject:update',
  'finance:subject:merge',
  'finance:account:view',
  'finance:account:create',
  'finance:account:update',
  'finance:voucher:view',
  'finance:voucher:create',
  'finance:voucher:post',
  'finance:voucher:reverse',
  'finance:voucher:void',
  'finance:report:view',
  'finance:report:export',
  'finance:receivable:view',
  'finance:receivable:create',
  'finance:receivable:reverse',
  'finance:payable:view',
  'finance:payable:create',
  'finance:payable:reverse',
  'finance:receipt:view',
  'finance:receipt:create',
  'finance:receipt:reverse',
  'finance:payment:view',
  'finance:payment:create',
  'finance:payment:reverse',
  'finance:invoice:view',
  'finance:invoice:create',
  'finance:asset:view',
  'finance:asset:create',
  'finance:asset:update',
  'finance:asset:depreciate',
  'finance:period:view',
  'finance:period:close',
  'finance:period:carry',
  'finance:cost:view',
  'finance:cost:create',
  'finance:cost:execute',
  'finance:costing:view',
  'finance:bank:view',
  'finance:bank:sync',
  'finance:bank:manage',
  'finance:budget:view',
  'finance:budget:create',
  'finance:voucher:validate',
  'finance:voucher:attach',
  'finance:template:view',
  'finance:template:create',
  'finance:expense:view',
  'finance:expense:create',
  'finance:expense:approve',
  'finance:expense:pay',
  'finance:expense:ocr',
  'finance:collection:view',
  'finance:collection:plan',
  'finance:provision:view',
  'finance:provision:approve',
  'finance:bank-match:view',
  'finance:bank-match:run',
  'finance:cashflow:view',
  'finance:cashflow:simulate',
  'finance:cost:rollback',
  'finance:period:check',
  'finance:period:reopen',
  'finance:budget:occupy',
  'flow:define:view',
  'flow:define:create',
  'flow:define:update',
  'flow:monitor:view',
  'flow:todo:view',
  'flow:todo:approve',
  'flow:todo:all',
  'flow:start',
  'risk:view',
  'risk:scan',
  'risk:assign',
  'risk:close',
  'oa:notice:view',
  'oa:notice:create',
  'oa:chat:view',
  'oa:chat:create',
  'oa:project:view',
  'oa:project:create',
  'oa:task:view',
  'oa:task:create',
  'oa:document:view',
  'oa:document:create',
  'hr:recruit:view',
  'hr:recruit:create',
  'hr:recruit:approve',
  'hr:attendance:view',
  'hr:attendance:create',
  'hr:attendance:approve',
  'hr:payroll:view',
  'hr:payroll:create',
  'hr:payroll:approve',
  'hr:payroll:detail',
  'hr:performance:view',
  'hr:performance:create',
  'hr:performance:approve',
  'hr:training:view',
  'hr:training:create',
  'hr:admin-asset:view',
  'hr:admin-asset:create',
  'hr:admin-asset:update',
  'hr:fleet:view',
  'hr:fleet:create',
  'hr:fleet:update',
  'hr:fleet:dispatch',
  'hr:extension:view',
  'hr:extension:update',
  'hr:contract:view',
  'hr:contract:create',
  'hr:contract:renew',
  'hr:contract:terminate',
  'shop:store:view',
  'shop:store:create',
  'shop:store:update',
  'shop:goods:view',
  'shop:goods:create',
  'shop:goods:update',
  'shop:order:view',
  'shop:order:sync',
  'shop:order:ship',
  'shop:promotion:view',
  'shop:promotion:create',
  'shop:promotion:stock',
  'shop:promotion:effect',
  'shop:payment:view',
  'shop:payment:create',
  'shop:payment:reconcile',
  'shop:refund:view',
  'shop:refund:create',
  'shop:refund:approve',
  'shop:logistics:view',
  'shop:logistics:update',
  'shop:cs:view',
  'shop:cs:create',
  'shop:cs:reply',
  'shop:cs:qc',
  'shop:report:view',
  'hr:employee:view',
  'hr:employee:create',
  'hr:employee:update',
  'hr:employee:delete',
  'system:company:view',
  'system:company:create',
  'system:company:update',
  'system:company:delete',
  'system:org:view',
  'system:org:create',
  'system:org:update',
  'system:org:delete',
  'system:dept:view',
  'system:dept:create',
  'system:dept:update',
  'system:dept:delete',
  'system:position:view',
  'system:position:create',
  'system:position:update',
  'system:position:delete',
  'system:user:view',
  'system:user:create',
  'system:user:update',
  'system:user:delete',
  'system:role:view',
  'system:role:create',
  'system:role:update',
  'system:role:delete',
  'system:permission:view',
  'system:permission:create',
  'system:permission:update',
  'system:permission:delete',
  'system:menu:view',
  'system:menu:create',
  'system:menu:update',
  'system:menu:delete',
  'system:data-scope:view',
  'system:data-scope:create',
  'system:data-scope:update',
  'system:data-scope:delete',
  'system:dict:view',
  'system:dict:create',
  'system:dict:update',
  'system:dict:delete',
  'system:sequence:view',
  'system:sequence:create',
  'system:sequence:update',
  'system:sequence:delete',
  'system:sequence:next',
  'system:audit:view',
  'system:login-log:view',
  'system:config:view',
  'system:config:update',
  'system:lang:view',
  'system:lang:update',
  'system:currency:view',
  'system:currency:update',
  'system:notify:view',
  'system:notify:create',
  'system:notify:update',
  'system:notify:record:view',
  'system:notify-rule:view',
  'system:notify-rule:create',
  'system:notify-rule:update',
  'system:notify-rule:delete',
  'system:export-watermark:view',
  'system:backup:view',
  'system:backup:manage',
  'system:backup:execute',
  'system:backup:restore',
  'system:custom-field:view',
  'system:custom-field:create',
  'system:custom-field:update',
  'system:custom-field:delete',
  'system:custom-form:view',
  'system:custom-form:create',
  'system:custom-form:update',
  'system:custom-form:delete',
  'system:revision:view',
  'system:revision:create',
  'system:alert-rule:view',
  'system:alert-rule:create',
  'system:alert-rule:update',
  'system:alert-rule:delete',
  'user:favorite:view',
  'user:favorite:manage',
  'user:view-config:manage',
  'ops:security:view',
  'ops:security:handle',
  'ops:slowsql:view',
  'system:file:view',
  'system:file:upload',
  'system:io:view',
  'system:io:import',
  'system:io:export',
  'system:openapi:view',
  'system:openapi:create',
  'system:openapi:update',
  'system:openapi:delete',
  'system:monitor:view',
  'system:monitor:update',
  'system:feature:view',
  'system:feature:create',
  'system:feature:update',
  'system:feature:delete',
  'system:integration:view',
  'system:integration:create',
  'system:integration:update',
  'system:integration:delete',
  'mobile:todo:view',
  'mobile:inventory:view',
  'mobile:pick:view',
  'mobile:scan:view',
  'print:template:view',
  'print:template:create',
  'print:template:update',
  'print:template:delete',
  'print:job:create',
  'print:job:view',
  'print:job:retry',
  'print:record:view',
  'print:record:reprint',
  'print:label:view',
  'print:label:create',
  'print:label:update',
  'ai:config:view',
  'ai:config:create',
  'ai:config:update',
  'ai:config:delete',
  'ai:chat',
  'ai:confirm',
  'ai:task:view',
  'ai:model:view',
  'ai:model:create',
  'ai:ocr',
  'ai:doc:parse',
  'ai:recommend',
  'ai:forecast',
  'ai:anomaly',
  'ai:reconcile',
  'ai:subject.match',
  'ai:report',
  'ai:rag',
  'ai:cs',
  'ai:resume',
  'ai:label',
  'procurement:advice:view',
  'procurement:advice:create',
  'procurement:advice:confirm'
]

const MENU_SEEDS: MenuSeed[] = [
  { parentRoute: null, routePath: '/dashboard', menuName: '工作台', componentPath: 'dashboard/index', icon: 'DataBoard', permCode: 'dashboard:view', sortNo: 1 },
  { parentRoute: '/dashboard', routePath: '/workbench/sales-trend', menuName: '销售趋势', componentPath: 'workbench/sales-trend/index', icon: 'TrendCharts', permCode: 'dashboard:view', sortNo: 1 },
  { parentRoute: '/dashboard', routePath: '/common/favorite', menuName: '我的收藏', componentPath: 'common/favorite/index', icon: 'Star', permCode: 'user:favorite:view', sortNo: 4 },
  { parentRoute: '/dashboard', routePath: '/workbench/cash-flow', menuName: '资金预测', componentPath: 'workbench/cash-flow/index', icon: 'DataBoard', permCode: 'dashboard:view', sortNo: 2 },
  { parentRoute: '/dashboard', routePath: '/workbench/briefing', menuName: '经营简报', componentPath: 'workbench/briefing/index', icon: 'Document', permCode: 'workbench:briefing:view', sortNo: 3 },
  { parentRoute: '/dashboard', routePath: '/dashboard/offline-queue', menuName: '待同步表单', componentPath: 'common/offline/index', icon: 'Refresh', permCode: 'dashboard:view', sortNo: 4 },
  { parentRoute: null, routePath: '/sales', menuName: '销售客户', componentPath: null, icon: 'OfficeBuilding', permCode: null, sortNo: 2 },
  { parentRoute: '/sales', routePath: '/sales/customer', menuName: '客户 360', componentPath: 'sales/customer/index', icon: 'User', permCode: 'sales:customer:view', sortNo: 1 },
  { parentRoute: '/sales', routePath: '/sales/lead', menuName: '线索池', componentPath: 'sales/lead/index', icon: 'Connection', permCode: 'sales:lead:view', sortNo: 2 },
  { parentRoute: '/sales', routePath: '/sales/follow', menuName: '客户跟进流水', componentPath: 'sales/follow/index', icon: 'ChatLineRound', permCode: 'sales:lead:view', sortNo: 28 },
  { parentRoute: '/sales', routePath: '/sales/opportunity', menuName: '商机管道', componentPath: 'sales/opportunity/index', icon: 'DataBoard', permCode: 'sales:opportunity:view', sortNo: 3 },
  { parentRoute: '/sales', routePath: '/sales/quotation', menuName: '报价单', componentPath: 'sales/quotation/index', icon: 'Document', permCode: 'sales:quotation:view', sortNo: 4 },
  { parentRoute: '/sales', routePath: '/sales/contract', menuName: '销售合同', componentPath: 'sales/contract/index', icon: 'Document', permCode: 'sales:contract:view', sortNo: 5 },
  { parentRoute: '/sales', routePath: '/sales/clause', menuName: '合同条款库', componentPath: 'sales/clause/index', icon: 'Tickets', permCode: 'sales:clause:view', sortNo: 6 },
  { parentRoute: '/sales', routePath: '/sales/contract-fulfillment', menuName: '合同履约', componentPath: 'sales/contract-fulfillment/index', icon: 'Refresh', permCode: 'sales:contract:view', sortNo: 7 },
  { parentRoute: '/sales', routePath: '/sales/order', menuName: '销售单', componentPath: 'sales/order/index', icon: 'Tickets', permCode: 'sales:order:view', sortNo: 6 },
  { parentRoute: '/sales', routePath: '/sales/pos', menuName: 'POS 收银', componentPath: 'sales/pos/index', icon: 'Tickets', permCode: 'sales:pos:create', sortNo: 7 },
  { parentRoute: '/sales', routePath: '/sales/statement', menuName: '客户对账', componentPath: 'sales/statement/index', icon: 'Collection', permCode: 'sales:statement:view', sortNo: 8 },
  { parentRoute: '/sales', routePath: '/sales/shipment', menuName: '出货单', componentPath: 'sales/shipment/index', icon: 'Tickets', permCode: 'sales:shipment:view', sortNo: 9 },
  { parentRoute: '/sales', routePath: '/sales/return', menuName: '销售退货', componentPath: 'sales/return/index', icon: 'Document', permCode: 'sales:return:view', sortNo: 10 },
  { parentRoute: '/sales', routePath: '/sales/report', menuName: '销售报表', componentPath: 'sales/report/index', icon: 'DataBoard', permCode: 'sales:report:view', sortNo: 11 },
  { parentRoute: '/sales', routePath: '/sales/price-agreement', menuName: '价格协议', componentPath: 'sales/price-agreement/index', icon: 'Collection', permCode: 'sales:price:view', sortNo: 12 },
  { parentRoute: '/sales', routePath: '/sales/target', menuName: '销售目标', componentPath: 'sales/target/index', icon: 'DataBoard', permCode: 'sales:target:view', sortNo: 13 },
  { parentRoute: '/sales', routePath: '/sales/extension', menuName: '销售扩展', componentPath: 'sales/extension/index', icon: 'Operation', permCode: 'sales:lead:view', sortNo: 14 },
  { parentRoute: '/sales', routePath: '/sales/delivery', menuName: '出货跟踪与异常', componentPath: 'sales/delivery/index', icon: 'Position', permCode: 'sales:shipment:tracking', sortNo: 15 },
  { parentRoute: '/sales', routePath: '/sales/pos-shift', menuName: 'POS 交接班', componentPath: 'sales/pos-shift/index', icon: 'Clock', permCode: 'sales:pos:shift', sortNo: 16 },
  { parentRoute: '/sales', routePath: '/sales/promotion', menuName: '组合促销', componentPath: 'sales/promotion/index', icon: 'Present', permCode: 'sales:promotion:bundle', sortNo: 17 },
  { parentRoute: '/sales', routePath: '/sales/crm-extension', menuName: '佣金与客户运营', componentPath: 'sales/crm-extension/index', icon: 'Money', permCode: 'sales:commission:view', sortNo: 18 },
  { parentRoute: null, routePath: '/purchase', menuName: '采购供应', componentPath: null, icon: 'Tickets', permCode: null, sortNo: 3 },
  { parentRoute: '/purchase', routePath: '/purchase/supplier', menuName: '供应商档案', componentPath: 'purchase/supplier/index', icon: 'OfficeBuilding', permCode: 'purchase:supplier:view', sortNo: 1 },
  { parentRoute: '/purchase', routePath: '/purchase/evaluate', menuName: '供应商评级', componentPath: 'purchase/evaluate/index', icon: 'DataBoard', permCode: 'purchase:supplier:view', sortNo: 2 },
  { parentRoute: '/purchase', routePath: '/purchase/inquiry', menuName: '询价比价', componentPath: 'purchase/inquiry/index', icon: 'Connection', permCode: 'purchase:inquiry:view', sortNo: 3 },
  { parentRoute: '/purchase', routePath: '/purchase/demand', menuName: '采购需求', componentPath: 'purchase/demand/index', icon: 'Tickets', permCode: 'purchase:demand:view', sortNo: 4 },
  { parentRoute: '/purchase', routePath: '/purchase/crossdock', menuName: '越库直发', componentPath: 'purchase/crossdock/index', icon: 'Truck', permCode: 'purchase:crossdock:view', sortNo: 5 },
  { parentRoute: '/purchase', routePath: '/purchase/fines', menuName: '供应商罚款', componentPath: 'purchase/fines/index', icon: 'Warning', permCode: 'purchase:fine:view', sortNo: 6 },
  { parentRoute: '/purchase', routePath: '/purchase/order', menuName: '采购订单', componentPath: 'purchase/order/index', icon: 'Tickets', permCode: 'purchase:order:view', sortNo: 5 },
  { parentRoute: '/purchase', routePath: '/purchase/receipt', menuName: '采购收货', componentPath: 'purchase/receipt/index', icon: 'Tickets', permCode: 'purchase:receipt:view', sortNo: 6 },
  { parentRoute: '/purchase', routePath: '/purchase/statement', menuName: '供应商对账', componentPath: 'purchase/statement/index', icon: 'Collection', permCode: 'purchase:statement:view', sortNo: 7 },
  { parentRoute: '/purchase', routePath: '/purchase/contract', menuName: '采购合同', componentPath: 'purchase/contract/index', icon: 'Document', permCode: 'purchase:contract:view', sortNo: 8 },
  { parentRoute: '/purchase', routePath: '/purchase/outsourcing', menuName: '委外加工', componentPath: 'purchase/outsourcing/index', icon: 'Tickets', permCode: 'purchase:order:view', sortNo: 9 },
  { parentRoute: '/purchase', routePath: '/purchase/logistics', menuName: '物流运单', componentPath: 'purchase/logistics/index', icon: 'Connection', permCode: 'purchase:logistics:view', sortNo: 10 },
  { parentRoute: '/purchase', routePath: '/purchase/return', menuName: '采购退货', componentPath: 'purchase/return/index', icon: 'Document', permCode: 'purchase:return:view', sortNo: 11 },
  { parentRoute: '/purchase', routePath: '/purchase/price', menuName: '采购价目', componentPath: 'purchase/price/index', icon: 'Collection', permCode: 'purchase:price:view', sortNo: 12 },
  { parentRoute: '/purchase', routePath: '/purchase/report', menuName: '采购报表', componentPath: 'purchase/report/index', icon: 'DataBoard', permCode: 'purchase:report:view', sortNo: 13 },
  { parentRoute: '/purchase', routePath: '/purchase/portal', menuName: '供应商门户', componentPath: 'purchase/portal/index', icon: 'OfficeBuilding', permCode: 'purchase:supplier:view', sortNo: 14 },
  { parentRoute: '/purchase', routePath: '/purchase/portal-accounts', menuName: '门户账号', componentPath: 'purchase/portal-accounts/index', icon: 'User', permCode: 'purchase:portal:manage', sortNo: 15 },
  { parentRoute: '/purchase', routePath: '/purchase/extension', menuName: '采购扩展', componentPath: 'purchase/extension/index', icon: 'Operation', permCode: 'purchase:supplier:view', sortNo: 15 },
  { parentRoute: null, routePath: '/inventory', menuName: '库存仓储', componentPath: null, icon: 'Collection', permCode: null, sortNo: 4 },
  { parentRoute: '/inventory', routePath: '/inventory/product', menuName: '产品与 SKU', componentPath: 'inventory/product/index', icon: 'Collection', permCode: 'inventory:product:view', sortNo: 1 },
  { parentRoute: '/inventory', routePath: '/inventory/warehouse', menuName: '仓库库位', componentPath: 'inventory/warehouse/index', icon: 'Tickets', permCode: 'inventory:warehouse:view', sortNo: 2 },
  { parentRoute: '/inventory', routePath: '/inventory/barcode', menuName: '条码标签', componentPath: 'inventory/barcode/index', icon: 'Collection', permCode: 'inventory:product:view', sortNo: 3 },
  { parentRoute: '/inventory', routePath: '/inventory/balance', menuName: '库存查询', componentPath: 'inventory/balance/index', icon: 'DataBoard', permCode: 'inventory:balance:view', sortNo: 4 },
  { parentRoute: '/inventory', routePath: '/inventory/ledger', menuName: '库存流水', componentPath: 'inventory/ledger/index', icon: 'Document', permCode: 'inventory:ledger:view', sortNo: 5 },
  { parentRoute: '/inventory', routePath: '/inventory/trace', menuName: '批次追溯', componentPath: 'inventory/trace/index', icon: 'Connection', permCode: 'inventory:trace:view', sortNo: 6 },
  { parentRoute: '/inventory', routePath: '/inventory/alert', menuName: '库存预警', componentPath: 'inventory/alert/index', icon: 'Bell', permCode: 'inventory:alert:view', sortNo: 7 },
  { parentRoute: '/inventory', routePath: '/inventory/stocktake', menuName: '盘点', componentPath: 'inventory/stocktake/index', icon: 'Document', permCode: 'inventory:stocktake:view', sortNo: 8 },
  { parentRoute: '/inventory', routePath: '/inventory/adjustment', menuName: '库存调整', componentPath: 'inventory/adjustment/index', icon: 'Edit', permCode: 'inventory:adjustment:view', sortNo: 17 },
  { parentRoute: '/inventory', routePath: '/inventory/transfer', menuName: '调拨', componentPath: 'inventory/transfer/index', icon: 'Connection', permCode: 'inventory:transfer:view', sortNo: 9 },
  { parentRoute: '/inventory', routePath: '/inventory/assembly', menuName: '拆装', componentPath: 'inventory/assembly/index', icon: 'Collection', permCode: 'inventory:assembly:view', sortNo: 10 },
  { parentRoute: '/inventory', routePath: '/inventory/wave-pick', menuName: '波次拣货', componentPath: 'inventory/wave-pick/index', icon: 'Tickets', permCode: 'inventory:wave:view', sortNo: 11 },
  { parentRoute: '/inventory', routePath: '/inventory/putaway-strategy', menuName: '上架策略', componentPath: 'inventory/putaway-strategy/index', icon: 'Setting', permCode: 'inventory:putaway:view', sortNo: 12 },
  { parentRoute: '/inventory', routePath: '/inventory/inout', menuName: '出入库', componentPath: 'inventory/inout/index', icon: 'Tickets', permCode: 'inventory:inout:create', sortNo: 13 },
  { parentRoute: '/inventory', routePath: '/inventory/io-doc', menuName: '出入库单', componentPath: 'inventory/io-doc/index', icon: 'Document', permCode: 'inventory:io-doc:view', sortNo: 27 },
  { parentRoute: '/inventory', routePath: '/inventory/lock', menuName: '库存锁定', componentPath: 'inventory/lock/index', icon: 'Lock', permCode: 'inventory:balance:view', sortNo: 14 },
  { parentRoute: '/inventory', routePath: '/inventory/report', menuName: '库存报表', componentPath: 'inventory/report/index', icon: 'DataBoard', permCode: 'inventory:report:view', sortNo: 15 },
  { parentRoute: '/inventory', routePath: '/inventory/ops', menuName: '库存作业增强', componentPath: 'inventory/ops/index', icon: 'Operation', permCode: 'inventory:balance:view', sortNo: 16 },
  { parentRoute: null, routePath: '/mfg', menuName: '生产制造', componentPath: null, icon: 'Setting', permCode: null, sortNo: 6 },
  { parentRoute: '/mfg', routePath: '/mfg/bom', menuName: 'BOM', componentPath: 'mfg/bom/index', icon: 'Collection', permCode: 'mfg:bom:view', sortNo: 1 },
  { parentRoute: '/mfg', routePath: '/mfg/routing', menuName: '工艺路线', componentPath: 'mfg/routing/index', icon: 'Connection', permCode: 'mfg:routing:view', sortNo: 2 },
  { parentRoute: '/mfg', routePath: '/mfg/mrp', menuName: 'MRP 运算', componentPath: 'mfg/mrp/index', icon: 'DataBoard', permCode: 'mfg:mrp:view', sortNo: 3 },
  { parentRoute: '/mfg', routePath: '/mfg/gantt', menuName: '排产甘特', componentPath: 'mfg/gantt/index', icon: 'DataBoard', permCode: 'mfg:plan:view', sortNo: 4 },
  { parentRoute: '/mfg', routePath: '/mfg/work-order', menuName: '生产工单', componentPath: 'mfg/work-order/index', icon: 'Tickets', permCode: 'mfg:work-order:view', sortNo: 5 },
  { parentRoute: '/mfg', routePath: '/mfg/execution', menuName: '工单执行', componentPath: 'mfg/execution/index', icon: 'Tickets', permCode: 'mfg:work-order:view', sortNo: 6 },
  { parentRoute: '/mfg', routePath: '/mfg/issue', menuName: '领料退料', componentPath: 'mfg/issue/index', icon: 'Collection', permCode: 'mfg:issue:create', sortNo: 7 },
  { parentRoute: '/mfg', routePath: '/mfg/complete', menuName: '完工入库', componentPath: 'mfg/complete/index', icon: 'Tickets', permCode: 'mfg:complete:create', sortNo: 8 },
  { parentRoute: '/mfg', routePath: '/mfg/qc', menuName: '生产质检', componentPath: 'mfg/qc/index', icon: 'Document', permCode: 'mfg:qc:view', sortNo: 9 },
  { parentRoute: '/mfg', routePath: '/mfg/equipment', menuName: '设备', componentPath: 'mfg/equipment/index', icon: 'Setting', permCode: 'mfg:equipment:view', sortNo: 10 },
  { parentRoute: '/mfg', routePath: '/mfg/report', menuName: '生产报表', componentPath: 'mfg/report/index', icon: 'DataBoard', permCode: 'mfg:report:view', sortNo: 11 },
  { parentRoute: '/mfg', routePath: '/mfg/exception', menuName: '生产异常', componentPath: 'mfg/exception/index', icon: 'Bell', permCode: 'mfg:exception:view', sortNo: 12 },
  { parentRoute: '/mfg', routePath: '/mfg/extension', menuName: '生产扩展', componentPath: 'mfg/extension/index', icon: 'Grid', permCode: 'mfg:bom:view', sortNo: 13 },
  { parentRoute: '/mfg', routePath: '/mfg/material-return', menuName: '退料与需求汇总', componentPath: 'mfg/material-return/index', icon: 'RefreshLeft', permCode: 'mfg:return:view', sortNo: 14 },
  { parentRoute: null, routePath: '/finance', menuName: '财务结算', componentPath: null, icon: 'DataBoard', permCode: null, sortNo: 7 },
  { parentRoute: '/finance', routePath: '/finance/dashboard', menuName: '财务仪表盘', componentPath: 'finance/dashboard/index', icon: 'DataBoard', permCode: 'finance:report:view', sortNo: 1 },
  { parentRoute: '/finance', routePath: '/finance/subject', menuName: '会计科目', componentPath: 'finance/subject/index', icon: 'Collection', permCode: 'finance:subject:view', sortNo: 2 },
  { parentRoute: '/finance', routePath: '/finance/voucher', menuName: '凭证', componentPath: 'finance/voucher/index', icon: 'Document', permCode: 'finance:voucher:view', sortNo: 3 },
  { parentRoute: '/finance', routePath: '/finance/trial-balance', menuName: '试算表', componentPath: 'finance/trial-balance/index', icon: 'Document', permCode: 'finance:report:view', sortNo: 4 },
  { parentRoute: '/finance', routePath: '/finance/statements', menuName: '三大报表', componentPath: 'finance/statements/index', icon: 'DataBoard', permCode: 'finance:report:view', sortNo: 5 },
  { parentRoute: '/finance', routePath: '/finance/expense', menuName: '费用报销', componentPath: 'finance/expense/index', icon: 'Tickets', permCode: 'finance:voucher:create', sortNo: 6 },
  { parentRoute: '/finance', routePath: '/finance/receivable', menuName: '应收账款', componentPath: 'finance/receivable/index', icon: 'Collection', permCode: 'finance:receivable:view', sortNo: 7 },
  { parentRoute: '/finance', routePath: '/finance/payable', menuName: '应付账款', componentPath: 'finance/payable/index', icon: 'Collection', permCode: 'finance:payable:view', sortNo: 8 },
  { parentRoute: '/finance', routePath: '/finance/receipt', menuName: '收款单', componentPath: 'finance/receipt/index', icon: 'Tickets', permCode: 'finance:receipt:view', sortNo: 9 },
  { parentRoute: '/finance', routePath: '/finance/payment', menuName: '付款单', componentPath: 'finance/payment/index', icon: 'Tickets', permCode: 'finance:payment:view', sortNo: 10 },
  { parentRoute: '/finance', routePath: '/finance/aging', menuName: '账龄分析', componentPath: 'finance/aging/index', icon: 'DataBoard', permCode: 'finance:report:view', sortNo: 11 },
  { parentRoute: '/finance', routePath: '/finance/fund-account', menuName: '资金账户', componentPath: 'finance/fund-account/index', icon: 'Collection', permCode: 'finance:account:view', sortNo: 12 },
  { parentRoute: '/finance', routePath: '/finance/fund-plan', menuName: '资金计划', componentPath: 'finance/fund-plan/index', icon: 'DataBoard', permCode: 'finance:report:view', sortNo: 13 },
  { parentRoute: '/finance', routePath: '/finance/invoice', menuName: '发票税务', componentPath: 'finance/invoice/index', icon: 'Document', permCode: 'finance:invoice:view', sortNo: 14 },
  { parentRoute: '/finance', routePath: '/finance/tax', menuName: '税务申报', componentPath: 'finance/tax/index', icon: 'Document', permCode: 'finance:invoice:view', sortNo: 15 },
  { parentRoute: '/finance', routePath: '/finance/cost', menuName: '成本重算', componentPath: 'finance/cost/index', icon: 'DataBoard', permCode: 'finance:cost:view', sortNo: 15 },
  { parentRoute: '/finance', routePath: '/finance/asset', menuName: '固定资产', componentPath: 'finance/asset/index', icon: 'Collection', permCode: 'finance:asset:view', sortNo: 16 },
  { parentRoute: '/finance', routePath: '/finance/period', menuName: '月结', componentPath: 'finance/period/index', icon: 'Lock', permCode: 'finance:period:view', sortNo: 17 },
  { parentRoute: '/finance', routePath: '/finance/report', menuName: '财务报表', componentPath: 'finance/report/index', icon: 'DataBoard', permCode: 'finance:report:view', sortNo: 18 },
  { parentRoute: '/finance', routePath: '/finance/budget', menuName: '预算管理', componentPath: 'finance/budget/index', icon: 'Collection', permCode: 'finance:budget:view', sortNo: 19 },
  { parentRoute: '/finance', routePath: '/finance/extension', menuName: '财务扩展', componentPath: 'finance/extension/index', icon: 'Grid', permCode: 'finance:report:view', sortNo: 20 },
  { parentRoute: '/finance', routePath: '/finance/bank', menuName: '银企直连', componentPath: 'finance/bank/index', icon: 'Link', permCode: 'finance:bank:view', sortNo: 21 },
  { parentRoute: '/finance', routePath: '/finance/costing', menuName: '存货收发存', componentPath: 'finance/costing/index', icon: 'DataBoard', permCode: 'finance:costing:view', sortNo: 22 },
  { parentRoute: null, routePath: '/oa', menuName: '协同办公', componentPath: null, icon: 'ChatDotRound', permCode: null, sortNo: 9 },
  { parentRoute: '/oa', routePath: '/oa/chat', menuName: '企业聊天', componentPath: 'oa/chat/index', icon: 'ChatDotRound', permCode: 'oa:chat:view', sortNo: 1 },
  { parentRoute: '/oa', routePath: '/oa/notice', menuName: '公告', componentPath: 'oa/notice/index', icon: 'Bell', permCode: 'oa:notice:view', sortNo: 2 },
  { parentRoute: '/oa', routePath: '/oa/flow-define', menuName: '流程定义', componentPath: 'oa/flow-define/index', icon: 'Connection', permCode: 'flow:define:view', sortNo: 3 },
  { parentRoute: '/oa', routePath: '/oa/todo', menuName: '待办', componentPath: 'oa/todo/index', icon: 'Tickets', permCode: 'flow:todo:view', sortNo: 4 },
  { parentRoute: '/oa', routePath: '/oa/done', menuName: '已办', componentPath: 'oa/done/index', icon: 'Tickets', permCode: 'flow:todo:view', sortNo: 5 },
  { parentRoute: '/oa', routePath: '/oa/flow-monitor', menuName: '流程监控', componentPath: 'oa/flow-monitor/index', icon: 'DataBoard', permCode: 'flow:monitor:view', sortNo: 6 },
  { parentRoute: '/oa', routePath: '/oa/project', menuName: '项目管理', componentPath: 'oa/project/index', icon: 'Collection', permCode: 'oa:project:view', sortNo: 7 },
  { parentRoute: '/oa', routePath: '/oa/knowledge', menuName: '文档知识库', componentPath: 'oa/knowledge/index', icon: 'Document', permCode: 'oa:document:view', sortNo: 8 },
  { parentRoute: '/oa', routePath: '/oa/meeting-task', menuName: '会议任务', componentPath: 'oa/meeting-task/index', icon: 'Tickets', permCode: 'oa:task:view', sortNo: 9 },
  { parentRoute: '/oa', routePath: '/oa/risk', menuName: '风险预警中心', componentPath: 'oa/risk/index', icon: 'Warning', permCode: 'risk:view', sortNo: 10 },
  { parentRoute: '/oa', routePath: '/oa/ops', menuName: '协同运营增强', componentPath: 'oa/ops/index', icon: 'Operation', permCode: 'oa:notice:view', sortNo: 11 },
  { parentRoute: '/oa', routePath: '/oa/project-board', menuName: '项目看板与甘特', componentPath: 'oa/project-board/index', icon: 'Grid', permCode: 'oa:project:view', sortNo: 12 },
  { parentRoute: null, routePath: '/shop', menuName: '商城渠道', componentPath: null, icon: 'OfficeBuilding', permCode: null, sortNo: 10 },
  { parentRoute: '/shop', routePath: '/shop/store', menuName: '店铺配置', componentPath: 'shop/store/index', icon: 'OfficeBuilding', permCode: 'shop:store:view', sortNo: 1 },
  { parentRoute: '/shop', routePath: '/shop/goods-map', menuName: '商品映射', componentPath: 'shop/goods-map/index', icon: 'Connection', permCode: 'shop:goods:view', sortNo: 2 },
  { parentRoute: '/shop', routePath: '/shop/order-sync', menuName: '订单同步', componentPath: 'shop/order-sync/index', icon: 'Tickets', permCode: 'shop:order:view', sortNo: 3 },
  { parentRoute: '/shop', routePath: '/shop/promotion', menuName: '营销', componentPath: 'shop/promotion/index', icon: 'DataBoard', permCode: 'shop:promotion:view', sortNo: 4 },
  { parentRoute: '/shop', routePath: '/shop/payment', menuName: '支付', componentPath: 'shop/payment/index', icon: 'Collection', permCode: 'shop:payment:view', sortNo: 5 },
  { parentRoute: '/shop', routePath: '/shop/logistics', menuName: '物流', componentPath: 'shop/logistics/index', icon: 'Connection', permCode: 'shop:logistics:view', sortNo: 6 },
  { parentRoute: '/shop', routePath: '/shop/cs', menuName: '客服', componentPath: 'shop/cs/index', icon: 'ChatDotRound', permCode: 'shop:cs:view', sortNo: 7 },
  { parentRoute: '/shop', routePath: '/shop/report', menuName: '渠道报表', componentPath: 'shop/report/index', icon: 'DataBoard', permCode: 'shop:report:view', sortNo: 8 },
  { parentRoute: '/shop', routePath: '/shop/coupon', menuName: '优惠券', componentPath: 'shop/coupon/index', icon: 'Ticket', permCode: 'shop:promotion:view', sortNo: 9 },
  { parentRoute: '/shop', routePath: '/shop/seckill', menuName: '秒杀活动', componentPath: 'shop/seckill/index', icon: 'AlarmClock', permCode: 'shop:promotion:view', sortNo: 10 },
  { parentRoute: '/shop', routePath: '/shop/activity-stock', menuName: '活动库存', componentPath: 'shop/activity-stock/index', icon: 'Box', permCode: 'shop:promotion:stock', sortNo: 11 },
  { parentRoute: '/shop', routePath: '/shop/promotion-effect', menuName: '促销效果', componentPath: 'shop/promotion-effect/index', icon: 'TrendCharts', permCode: 'shop:promotion:effect', sortNo: 12 },
  { parentRoute: '/shop', routePath: '/shop/reconciliation', menuName: '支付对账', componentPath: 'shop/reconciliation/index', icon: 'Money', permCode: 'shop:payment:reconcile', sortNo: 13 },
  { parentRoute: '/shop', routePath: '/shop/refund', menuName: '退款审批', componentPath: 'shop/refund/index', icon: 'RefreshLeft', permCode: 'shop:refund:view', sortNo: 14 },
  { parentRoute: null, routePath: '/hr', menuName: '人事行政', componentPath: null, icon: 'User', permCode: null, sortNo: 8 },
  { parentRoute: '/hr', routePath: '/hr/employee', menuName: '员工档案', componentPath: 'hr/employee/index', icon: 'UserFilled', permCode: 'hr:employee:view', sortNo: 1 },
  { parentRoute: '/hr', routePath: '/hr/recruit', menuName: '招聘', componentPath: 'hr/recruit/index', icon: 'User', permCode: 'hr:recruit:view', sortNo: 2 },
  { parentRoute: '/hr', routePath: '/hr/attendance', menuName: '考勤排班', componentPath: 'hr/attendance/index', icon: 'DataBoard', permCode: 'hr:attendance:view', sortNo: 3 },
  { parentRoute: '/hr', routePath: '/hr/payroll', menuName: '薪酬', componentPath: 'hr/payroll/index', icon: 'Tickets', permCode: 'hr:payroll:view', sortNo: 4 },
  { parentRoute: '/hr', routePath: '/hr/performance', menuName: '绩效', componentPath: 'hr/performance/index', icon: 'DataBoard', permCode: 'hr:performance:view', sortNo: 5 },
  { parentRoute: '/hr', routePath: '/hr/training', menuName: '培训', componentPath: 'hr/training/index', icon: 'Collection', permCode: 'hr:training:view', sortNo: 6 },
  { parentRoute: '/hr', routePath: '/hr/admin-asset', menuName: '行政资产', componentPath: 'hr/admin-asset/index', icon: 'Collection', permCode: 'hr:admin-asset:view', sortNo: 7 },
  { parentRoute: '/hr', routePath: '/hr/fleet', menuName: '车队', componentPath: 'hr/fleet/index', icon: 'Tickets', permCode: 'hr:fleet:view', sortNo: 8 },
  { parentRoute: '/hr', routePath: '/hr/extension', menuName: '人事扩展', componentPath: 'hr/extension/index', icon: 'Operation', permCode: 'hr:extension:view', sortNo: 9 },
  { parentRoute: '/hr', routePath: '/hr/ops', menuName: '人事运营增强', componentPath: 'hr/ops/index', icon: 'Operation', permCode: 'hr:attendance:view', sortNo: 10 },
  { parentRoute: '/hr', routePath: '/hr/recruit-pipeline', menuName: '招聘管道与人才库', componentPath: 'hr/recruit-pipeline/index', icon: 'Grid', permCode: 'hr:recruit:view', sortNo: 11 },
  { parentRoute: '/hr', routePath: '/hr/labor-contract', menuName: '劳动合同', componentPath: 'hr/labor-contract/index', icon: 'Tickets', permCode: 'hr:contract:view', sortNo: 12 },
  { parentRoute: null, routePath: '/system', menuName: '系统管理', componentPath: null, icon: 'Setting', permCode: null, sortNo: 9 },
  { parentRoute: '/system', routePath: '/system/company', menuName: '公司', componentPath: 'system/company/index', icon: 'OfficeBuilding', permCode: 'system:company:view', sortNo: 1 },
  { parentRoute: '/system', routePath: '/system/org', menuName: '组织树', componentPath: 'system/org/index', icon: 'Share', permCode: 'system:org:view', sortNo: 2 },
  { parentRoute: '/system', routePath: '/system/dept', menuName: '部门', componentPath: 'system/dept/index', icon: 'Tree', permCode: 'system:dept:view', sortNo: 3 },
  { parentRoute: '/system', routePath: '/system/position', menuName: '岗位', componentPath: 'system/position/index', icon: 'Postcard', permCode: 'system:position:view', sortNo: 4 },
  { parentRoute: '/system', routePath: '/system/user', menuName: '用户', componentPath: 'system/user/index', icon: 'User', permCode: 'system:user:view', sortNo: 5 },
  { parentRoute: '/system', routePath: '/system/role', menuName: '角色', componentPath: 'system/role/index', icon: 'UserFilled', permCode: 'system:role:view', sortNo: 6 },
  { parentRoute: '/system', routePath: '/system/permission', menuName: '权限', componentPath: 'system/permission/index', icon: 'Lock', permCode: 'system:permission:view', sortNo: 7 },
  { parentRoute: '/system', routePath: '/system/menu', menuName: '菜单', componentPath: 'system/menu/index', icon: 'Tickets', permCode: 'system:menu:view', sortNo: 8 },
  { parentRoute: '/system', routePath: '/system/data-scope', menuName: '数据权限', componentPath: 'system/data-scope/index', icon: 'Connection', permCode: 'system:data-scope:view', sortNo: 9 },
  { parentRoute: '/system', routePath: '/system/dict', menuName: '字典', componentPath: 'system/dict/index', icon: 'Collection', permCode: 'system:dict:view', sortNo: 10 },
  { parentRoute: '/system', routePath: '/system/sequence', menuName: '编码规则', componentPath: 'system/sequence/index', icon: 'Tickets', permCode: 'system:sequence:view', sortNo: 11 },
  { parentRoute: '/system', routePath: '/system/audit', menuName: '审计日志', componentPath: 'system/audit/index', icon: 'Document', permCode: 'system:audit:view', sortNo: 12 },
  { parentRoute: '/system', routePath: '/system/login-log', menuName: '登录日志', componentPath: 'system/login-log/index', icon: 'WarnTriangleFilled', permCode: 'system:login-log:view', sortNo: 21 },
  { parentRoute: '/system', routePath: '/system/config', menuName: '系统参数', componentPath: 'system/config/index', icon: 'Tools', permCode: 'system:config:view', sortNo: 22 },
  { parentRoute: '/system', routePath: '/system/currency', menuName: '汇率管理', componentPath: 'system/currency/index', icon: 'Money', permCode: 'system:currency:view', sortNo: 13 },
  { parentRoute: '/system', routePath: '/system/notify', menuName: '通知中心', componentPath: 'system/notify/index', icon: 'Bell', permCode: 'system:notify:view', sortNo: 13 },
  { parentRoute: '/system', routePath: '/system/notify-template', menuName: '通知模板', componentPath: 'system/notify-template/index', icon: 'Postcard', permCode: 'system:notify:view', sortNo: 23 },
  { parentRoute: '/system', routePath: '/system/notify-record', menuName: '通知发送记录', componentPath: 'system/notify-record/index', icon: 'Tickets', permCode: 'system:notify:record:view', sortNo: 24 },
  { parentRoute: '/system', routePath: '/system/export-watermark', menuName: '导出水印', componentPath: 'system/export-watermark/index', icon: 'Lock', permCode: 'system:export-watermark:view', sortNo: 25 },
  { parentRoute: '/system', routePath: '/system/backup', menuName: '备份与恢复', componentPath: 'system/backup/index', icon: 'Coin', permCode: 'system:backup:view', sortNo: 26 },
  { parentRoute: '/system', routePath: '/system/file', menuName: '文件存储', componentPath: 'system/file/index', icon: 'Folder', permCode: 'system:file:view', sortNo: 14 },
  { parentRoute: '/system', routePath: '/system/openapi', menuName: '开放平台', componentPath: 'system/openapi/index', icon: 'Connection', permCode: 'system:openapi:view', sortNo: 15 },
  { parentRoute: '/system', routePath: '/system/custom-field', menuName: '自定义字段', componentPath: 'system/custom-field/index', icon: 'Grid', permCode: 'system:custom-field:view', sortNo: 30 },
  { parentRoute: '/system', routePath: '/system/custom-form', menuName: '自定义表单', componentPath: 'system/custom-form/index', icon: 'Document', permCode: 'system:custom-form:view', sortNo: 31 },
  { parentRoute: '/system', routePath: '/system/revision', menuName: '版本快照', componentPath: 'system/revision/index', icon: 'Clock', permCode: 'system:revision:view', sortNo: 32 },
  { parentRoute: '/system', routePath: '/system/alert-rule', menuName: '告警规则', componentPath: 'system/alert-rule/index', icon: 'Bell', permCode: 'system:alert-rule:view', sortNo: 33 },
  { parentRoute: '/system', routePath: '/system/notify-rule', menuName: '通知规则', componentPath: 'system/notify-rule/index', icon: 'Operation', permCode: 'system:notify-rule:view', sortNo: 34 },
  { parentRoute: '/system', routePath: '/system/monitor', menuName: '系统监控', componentPath: 'system/monitor/index', icon: 'DataBoard', permCode: 'system:monitor:view', sortNo: 16 },
  { parentRoute: '/system', routePath: '/system/integration', menuName: '消息集成', componentPath: 'system/integration/index', icon: 'Bell', permCode: 'system:integration:view', sortNo: 17 },
  { parentRoute: '/system', routePath: '/system/api-docs', menuName: '接口文档', componentPath: 'system/api-docs/index', icon: 'Document', permCode: 'system:permission:view', sortNo: 18 },
  { parentRoute: '/system', routePath: '/system/features', menuName: '功能开关', componentPath: 'system/features/index', icon: 'Setting', permCode: 'system:feature:view', sortNo: 19 },
  { parentRoute: '/system', routePath: '/system/io', menuName: '导入导出', componentPath: 'system/io/index', icon: 'Sort', permCode: 'system:io:view', sortNo: 20 },
  { parentRoute: '/system', routePath: '/system/export-task', menuName: '导出任务', componentPath: 'system/export-task/index', icon: 'Download', permCode: 'system:io:view', sortNo: 35 },
  { parentRoute: '/system', routePath: '/system/lang', menuName: '语言包', componentPath: 'system/lang/index', icon: 'ChatDotRound', permCode: 'system:lang:view', sortNo: 27 },
  { parentRoute: '/system', routePath: '/system/security', menuName: '安全与性能', componentPath: 'system/security/index', icon: 'Warning', permCode: 'ops:security:view', sortNo: 21 },
  { parentRoute: null, routePath: '/print', menuName: '打印中心', componentPath: null, icon: 'Printer', permCode: null, sortNo: 10 },
  { parentRoute: '/print', routePath: '/print/template', menuName: '打印模板', componentPath: 'print/template/index', icon: 'Document', permCode: 'print:template:view', sortNo: 1 },
  { parentRoute: '/print', routePath: '/print/job', menuName: '打印任务', componentPath: 'print/job/index', icon: 'Tickets', permCode: 'print:job:view', sortNo: 2 },
  { parentRoute: '/print', routePath: '/print/record', menuName: '打印记录', componentPath: 'print/record/index', icon: 'Document', permCode: 'print:record:view', sortNo: 3 },
  { parentRoute: '/print', routePath: '/print/label', menuName: '标签模板', componentPath: 'print/label/index', icon: 'Collection', permCode: 'print:label:view', sortNo: 4 },
  { parentRoute: '/print', routePath: '/print/label-instance', menuName: '标签序列号', componentPath: 'print/label-instance/index', icon: 'Collection', permCode: 'print:label:view', sortNo: 5 },
  { parentRoute: null, routePath: '/ai', menuName: 'AI 助手', componentPath: null, icon: 'Robot', permCode: null, sortNo: 11 },
  { parentRoute: '/ai', routePath: '/ai/copilot', menuName: 'AI Copilot', componentPath: 'ai/copilot/index', icon: 'ChatDotRound', permCode: 'ai:chat', sortNo: 1 },
  { parentRoute: '/ai', routePath: '/ai/config', menuName: 'Prompt 配置', componentPath: 'ai/config/index', icon: 'Setting', permCode: 'ai:config:view', sortNo: 2 },
  { parentRoute: '/ai', routePath: '/ai/tools', menuName: '智能工具', componentPath: 'ai/tools/index', icon: 'MagicStick', permCode: 'ai:task:view', sortNo: 3 },
  { parentRoute: '/ai', routePath: '/ai/ocr', menuName: 'OCR 识别', componentPath: 'ai/ocr/index', icon: 'Document', permCode: 'ai:ocr', sortNo: 4 },
  { parentRoute: '/ai', routePath: '/ai/forecast', menuName: '销量预测', componentPath: 'ai/forecast/index', icon: 'DataBoard', permCode: 'ai:forecast', sortNo: 5 },
  { parentRoute: '/ai', routePath: '/ai/anomaly', menuName: '异常检测', componentPath: 'ai/anomaly/index', icon: 'Bell', permCode: 'ai:anomaly', sortNo: 6 },
  { parentRoute: '/ai', routePath: '/ai/report', menuName: '报表解读', componentPath: 'ai/report/index', icon: 'DataBoard', permCode: 'ai:report', sortNo: 7 },
  { parentRoute: '/ai', routePath: '/ai/knowledge', menuName: '企业知识库', componentPath: 'ai/knowledge/index', icon: 'Folder', permCode: 'ai:rag', sortNo: 8 },
  { parentRoute: '/ai', routePath: '/ai/resume', menuName: '简历解析', componentPath: 'ai/resume/index', icon: 'User', permCode: 'ai:resume', sortNo: 9 },
  { parentRoute: '/ai', routePath: '/ai/label', menuName: '标签识别', componentPath: 'ai/label/index', icon: 'Collection', permCode: 'ai:label', sortNo: 10 },
  { parentRoute: '/ai', routePath: '/ai/model', menuName: '模型配置', componentPath: 'ai/model/index', icon: 'Setting', permCode: 'ai:model:view', sortNo: 11 },
  { parentRoute: '/ai', routePath: '/ai/tasks', menuName: 'AI 审计任务', componentPath: 'ai/tasks/index', icon: 'Tickets', permCode: 'ai:task:view', sortNo: 12 },
  { parentRoute: '/ai', routePath: '/ai/procurement-advice', menuName: '智能询比价', componentPath: 'ai/procurement-advice/index', icon: 'ShoppingCart', permCode: 'procurement:advice:view', sortNo: 13 },
  { parentRoute: '/sales', routePath: '/sales/quotation-template', menuName: '报价模板', componentPath: 'sales/quotation-template/index', icon: 'Document', permCode: 'sales:quotation:view', sortNo: 90 },
  { parentRoute: '/sales', routePath: '/sales/exchange', menuName: '换货单', componentPath: 'sales/exchange/index', icon: 'Refresh', permCode: 'sales:return:view', sortNo: 91 },
  { parentRoute: '/sales', routePath: '/sales/return-reason', menuName: '退货原因', componentPath: 'sales/return-reason/index', icon: 'Collection', permCode: 'system:dict:view', sortNo: 92 },
  { parentRoute: '/sales', routePath: '/sales/complaint', menuName: '投诉工单', componentPath: 'sales/complaint/index', icon: 'Tickets', permCode: 'sales:complaint:view', sortNo: 93 },
  { parentRoute: '/sales', routePath: '/sales/visit', menuName: '客户回访', componentPath: 'sales/visit/index', icon: 'ChatLineRound', permCode: 'sales:visit:view', sortNo: 94 },
  { parentRoute: '/purchase', routePath: '/purchase/frame-agreement', menuName: '框架协议', componentPath: 'purchase/frame-agreement/index', icon: 'Document', permCode: 'purchase:contract:view', sortNo: 90 },
  { parentRoute: '/purchase', routePath: '/purchase/term-reminder', menuName: '条款提醒', componentPath: 'purchase/term-reminder/index', icon: 'Bell', permCode: 'system:monitor:view', sortNo: 91 },
  { parentRoute: '/mfg', routePath: '/mfg/plan', menuName: '生产计划', componentPath: 'mfg/plan/index', icon: 'Tickets', permCode: 'mfg:plan:view', sortNo: 90 },
  { parentRoute: '/mfg', routePath: '/mfg/qc/incoming', menuName: '来料检', componentPath: 'mfg/qc/incoming/index', icon: 'Document', permCode: 'mfg:qc:view', sortNo: 91 },
  { parentRoute: '/mfg', routePath: '/mfg/qc/inprocess', menuName: '过程检', componentPath: 'mfg/qc/inprocess/index', icon: 'Document', permCode: 'mfg:qc:view', sortNo: 92 },
  { parentRoute: '/mfg', routePath: '/mfg/qc/finished', menuName: '成品检', componentPath: 'mfg/qc/finished/index', icon: 'Document', permCode: 'mfg:qc:view', sortNo: 93 },
  { parentRoute: '/finance', routePath: '/finance/collection', menuName: '收账台', componentPath: 'finance/collection/index', icon: 'Money', permCode: 'finance:collection:view', sortNo: 23 },
  { parentRoute: '/finance', routePath: '/finance/income', menuName: '收入单', componentPath: 'finance/income/index', icon: 'Tickets', permCode: 'finance:receipt:view', sortNo: 90 },
  { parentRoute: '/finance', routePath: '/finance/income-category', menuName: '收入类别', componentPath: 'finance/income-category/index', icon: 'Collection', permCode: 'finance:expense:view', sortNo: 91 },
  { parentRoute: '/oa', routePath: '/oa/copy', menuName: '流程抄送', componentPath: 'oa/copy/index', icon: 'ChatLineRound', permCode: 'oa:task:view', sortNo: 90 },
  { parentRoute: '/oa', routePath: '/oa/recall', menuName: '流程追回', componentPath: 'oa/recall/index', icon: 'Refresh', permCode: 'oa:task:view', sortNo: 91 },
  { parentRoute: '/oa', routePath: '/oa/project-timetable', menuName: '项目时间表', componentPath: 'oa/project-timetable/index', icon: 'Tickets', permCode: 'oa:project:view', sortNo: 92 },
  { parentRoute: '/oa', routePath: '/oa/project-report', menuName: '项目报告', componentPath: 'oa/project-report/index', icon: 'Document', permCode: 'oa:project:view', sortNo: 93 },
  { parentRoute: '/shop', routePath: '/shop/goods-publish', menuName: '商品发布', componentPath: 'shop/goods-publish/index', icon: 'Connection', permCode: 'shop:goods:view', sortNo: 90 },
  { parentRoute: '/system', routePath: '/system/scheduler', menuName: '定时任务', componentPath: 'system/scheduler/index', icon: 'Setting', permCode: 'system:monitor:view', sortNo: 36 },
  { parentRoute: '/ai', routePath: '/ai/nl-query', menuName: '自然语言查询', componentPath: 'ai/nl-query/index', icon: 'ChatDotRound', permCode: 'ai:chat', sortNo: 14 },
  { parentRoute: '/print', routePath: '/print/center', menuName: '打印执行中心', componentPath: 'print/center/index', icon: 'Printer', permCode: 'print:job:view', sortNo: 90 },
  { parentRoute: '/dashboard', routePath: '/workbench/purchase', menuName: '采购看板', componentPath: 'workbench/purchase/index', icon: 'DataBoard', permCode: 'dashboard:view', sortNo: 90 },
  { parentRoute: '/dashboard', routePath: '/workbench/inventory', menuName: '库存看板', componentPath: 'workbench/inventory/index', icon: 'DataBoard', permCode: 'dashboard:view', sortNo: 91 },
  { parentRoute: null, routePath: '/mobile', menuName: '移动工作台', componentPath: null, icon: 'Connection', permCode: null, sortNo: 12 },
  { parentRoute: '/mobile', routePath: '/mobile/todo', menuName: '移动审批', componentPath: 'mobile/todo/index', icon: 'Tickets', permCode: 'mobile:todo:view', sortNo: 1 },
  { parentRoute: '/mobile', routePath: '/mobile/inventory', menuName: '移动库存', componentPath: 'mobile/inventory/index', icon: 'Collection', permCode: 'mobile:inventory:view', sortNo: 2 },
  { parentRoute: '/mobile', routePath: '/mobile/pick', menuName: '移动拣货', componentPath: 'mobile/pick/index', icon: 'Tickets', permCode: 'mobile:pick:view', sortNo: 3 },
  { parentRoute: '/mobile', routePath: '/mobile/scan', menuName: '扫码开单', componentPath: 'mobile/scan/index', icon: 'Connection', permCode: 'mobile:scan:view', sortNo: 4 }
]

/** 打印模板种子 */
const PRINT_TEMPLATE_SEEDS: Array<{
  code: string
  name: string
  bizType: string
  paper: string
  schema: Record<string, unknown>
}> = [
  {
    code: 'stock_io',
    name: '出入库单',
    bizType: 'stock_io',
    paper: 'A4',
    schema: {
      body: '<div class="print-doc"><h2>出入库单</h2>'
        + '<p>单据号：{{docNo}}　单据类型：{{ioType}}　状态：{{status}}</p>'
        + '<p>仓库：{{warehouseId}}　方向：{{direction}}　单据日期：{{docDate}}</p>'
        + '<p>成本金额：{{costAmount}}　暂估金额：{{provisionalAmount}}　备注：{{remark}}</p>'
        + '<table><thead><tr><th>商品</th><th>批次</th><th>入库数量</th><th>出库数量</th><th>单位成本</th><th>金额</th></tr></thead>'
        + '<tbody>{{#each lines}}<tr><td>{{lines.productId}}</td><td>{{lines.batchNo}}</td><td>{{lines.qtyIn}}</td>'
        + '<td>{{lines.qtyOut}}</td><td>{{lines.unitCost}}</td><td>{{lines.amount}}</td></tr>{{/each}}</tbody></table></div>',
      loops: [
        {
          key: 'lines',
          itemTemplate: '<tr><td>{{lines.productId}}</td><td>{{lines.batchNo}}</td><td>{{lines.qtyIn}}</td>'
            + '<td>{{lines.qtyOut}}</td><td>{{lines.unitCost}}</td><td>{{lines.amount}}</td></tr>'
        }
      ],
      fieldBindings: [
        { key: 'docNo', source: 'docNo' },
        { key: 'ioType', source: 'ioType' },
        { key: 'status', source: 'status' },
        { key: 'warehouseId', source: 'warehouseId' },
        { key: 'direction', source: 'direction' },
        { key: 'docDate', source: 'docDate' },
        { key: 'costAmount', source: 'costAmount' },
        { key: 'provisionalAmount', source: 'provisionalAmount' },
        { key: 'remark', source: 'remark' }
      ]
    }
  }
]

/** 自动凭证默认科目：按业务事件取用，租户可自行增删 */
const SUBJECT_SEEDS: Array<{ code: string; name: string; category: string; direction: string }> = [
  { code: '1001', name: '库存现金', category: '资产', direction: 'DEBIT' },
  { code: '1002', name: '银行存款', category: '资产', direction: 'DEBIT' },
  { code: '1122', name: '应收账款', category: '资产', direction: 'DEBIT' },
  { code: '1405', name: '库存商品', category: '资产', direction: 'DEBIT' },
  { code: '2202', name: '应付账款', category: '负债', direction: 'CREDIT' },
  { code: '6001', name: '主营业务收入', category: '损益', direction: 'CREDIT' },
  { code: '6401', name: '主营业务成本', category: '损益', direction: 'DEBIT' },
  { code: '6601', name: '销售费用', category: '损益', direction: 'DEBIT' },
  { code: '6602', name: '管理费用', category: '损益', direction: 'DEBIT' }
]

@Injectable()
export class PlatformSeederService implements OnModuleInit {
  private readonly logger = new Logger(PlatformSeederService.name)

  constructor(
    @InjectRepository(TenantEntity) private readonly tenantRepo: Repository<TenantEntity>,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity) private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity) private readonly permissionRepo: Repository<PermissionEntity>,
    @InjectRepository(MenuEntity) private readonly menuRepo: Repository<MenuEntity>,
    @InjectRepository(UserRoleEntity) private readonly userRoleRepo: Repository<UserRoleEntity>,
    @InjectRepository(RolePermissionEntity) private readonly rolePermissionRepo: Repository<RolePermissionEntity>,
    @InjectRepository(PrintTemplateEntity) private readonly printTemplateRepo: Repository<PrintTemplateEntity>,
    @InjectRepository(AccountSubjectEntity) private readonly subjectRepo: Repository<AccountSubjectEntity>
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seed()
  }

  private async seed(): Promise<void> {
    const tenant = await this.ensureTenant()
    const role = await this.ensureRole(tenant.id)
    await this.ensurePermissions()
    await this.bindRolePermissions(tenant.id, role.id)
    const admin = await this.ensureAdmin(tenant.id)
    await this.bindUserRole(tenant.id, admin.id, role.id)
    await this.ensureMenus(tenant.id)
    await this.ensureSubjects(tenant.id)
    await this.ensurePrintTemplates(tenant.id)
    this.logger.log('平台基础数据初始化完成')
  }

  /** 初始化自动凭证所需的基础科目，已存在的科目不覆盖用户修改 */
  private async ensureSubjects(tenantId: number): Promise<void> {
    for (const seed of SUBJECT_SEEDS) {
      const existing = await this.subjectRepo.findOne({ where: { tenantId, subjectCode: seed.code } })
      if (existing) continue
      await this.subjectRepo.save(this.subjectRepo.create({
        tenantId,
        subjectCode: seed.code,
        subjectName: seed.name,
        parentId: null,
        category: seed.category,
        direction: seed.direction,
        auxType: null,
        isLeaf: 1,
        status: 'ENABLED'
      }))
    }
  }

  /** 初始化打印模板：出入库单等单据的默认打印模板 */
  private async ensurePrintTemplates(tenantId: number): Promise<void> {
    for (const seed of PRINT_TEMPLATE_SEEDS) {
      const existing = await this.printTemplateRepo.findOne({ where: { tenantId, code: seed.code } })
      if (existing) {
        continue
      }
      await this.printTemplateRepo.save(
        this.printTemplateRepo.create({
          tenantId,
          code: seed.code,
          name: seed.name,
          bizType: seed.bizType,
          paper: seed.paper,
          schema: seed.schema,
          version: 1,
          isDefault: 1,
          isActive: 1,
          createdBy: null
        })
      )
    }
  }

  private async ensureTenant(): Promise<TenantEntity> {    const existing = await this.tenantRepo.findOne({ where: { tenantCode: 'default', isDeleted: 0 } })
    if (existing) {
      return existing
    }
    return this.tenantRepo.save(
      this.tenantRepo.create({
        tenantCode: 'default',
        tenantName: '默认租户',
        defaultOrgId: null,
        status: 'ACTIVE'
      })
    )
  }

  private async ensureRole(tenantId: number): Promise<RoleEntity> {
    const existing = await this.roleRepo.findOne({ where: { tenantId, roleCode: 'SUPER_ADMIN', isDeleted: 0 } })
    if (existing) {
      return existing
    }
    return this.roleRepo.save(
      this.roleRepo.create({
        tenantId,
        roleCode: 'SUPER_ADMIN',
        roleName: '超级管理员',
        dataScopeLevel: 'ALL',
        sortNo: 1,
        status: 'ACTIVE'
      })
    )
  }

  private async ensurePermissions(): Promise<void> {
    for (const permCode of PERMISSION_CODES) {
      const existing = await this.permissionRepo.findOne({ where: { permCode, isDeleted: 0 } })
      if (existing) {
        continue
      }
      await this.permissionRepo.save(
        this.permissionRepo.create({
          tenantId: 0,
          permCode,
          permName: permCode,
          permType: 'API',
          sortNo: 0
        })
      )
    }
  }

  private async bindRolePermissions(tenantId: number, roleId: number): Promise<void> {
    const permissions = await this.permissionRepo.find({ where: { isDeleted: 0 } })
    for (const permission of permissions) {
      const existing = await this.rolePermissionRepo.findOne({
        where: { tenantId, roleId, permissionId: permission.id }
      })
      if (existing) {
        continue
      }
      await this.rolePermissionRepo.save(
        this.rolePermissionRepo.create({ tenantId, roleId, permissionId: permission.id })
      )
    }
  }

  private async ensureAdmin(tenantId: number): Promise<UserEntity> {
    const existing = await this.userRepo.findOne({
      where: { tenantId, username: env.initialAdmin.username, isDeleted: 0 }
    })
    if (existing) {
      return existing
    }
    return this.userRepo.save(
      this.userRepo.create({
        tenantId,
        username: env.initialAdmin.username,
        passwordHash: hashPassword(env.initialAdmin.password),
        realName: env.initialAdmin.realName,
        deptId: null,
        orgId: null,
        mobile: null,
        status: 'ACTIVE',
        createdBy: null
      })
    )
  }

  private async bindUserRole(tenantId: number, userId: number, roleId: number): Promise<void> {
    const existing = await this.userRoleRepo.findOne({ where: { tenantId, userId, roleId } })
    if (existing) {
      return
    }
    await this.userRoleRepo.save(this.userRoleRepo.create({ tenantId, userId, roleId }))
  }

  private async ensureMenus(tenantId: number): Promise<void> {
    const menuMap = new Map<string, number>()
    for (const seed of MENU_SEEDS) {
      const parentId = seed.parentRoute ? (menuMap.get(seed.parentRoute) ?? null) : null
      const existing = await this.menuRepo.findOne({ where: { tenantId, routePath: seed.routePath } })
      if (existing) {
        const changed =
          existing.parentId !== parentId ||
          existing.menuName !== seed.menuName ||
          existing.componentPath !== seed.componentPath ||
          existing.icon !== seed.icon ||
          existing.permCode !== seed.permCode ||
          existing.sortNo !== seed.sortNo
        if (changed) {
          Object.assign(existing, {
            parentId,
            menuName: seed.menuName,
            componentPath: seed.componentPath,
            icon: seed.icon,
            permCode: seed.permCode,
            sortNo: seed.sortNo
          })
          await this.menuRepo.save(existing)
        }
        menuMap.set(seed.routePath, existing.id)
        continue
      }
      const saved = await this.menuRepo.save(
        this.menuRepo.create({
          tenantId,
          parentId,
          menuName: seed.menuName,
          routePath: seed.routePath,
          componentPath: seed.componentPath,
          icon: seed.icon,
          permCode: seed.permCode,
          sortNo: seed.sortNo,
          hidden: 0
        })
      )
      menuMap.set(seed.routePath, saved.id)
    }
  }
}
