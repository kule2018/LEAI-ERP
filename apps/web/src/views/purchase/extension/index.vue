<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  addRoundQuote, addSupplierBlacklist, addTrackNode, allocateCost, approveAward, approveLoss, approvePrice,
  changeOrder, checkSupplierBlacklist, compareQuotes, confirmOrderByPortal, confirmStatementByPortal, convertDemand,
  createArrivalPlan, createAward, createBankAccount, createEstimate, createFrameAgreement, createOutsourceLoss,
  createQualification,   listAwards, listFrameAgreements, listMatchEvidence, listOrderChanges, listQualifications,
  listSupplierBlacklists, listTrackNodes,
  liftSupplierBlacklist, markStatementDifference, mergeDemands, openQuoteRound, orderProgress, portalInvoice, portalShipment, priceHistory,
  priceMatrix, purchasePerformance, qualificationAlerts, receiveDifference, reconcileFreight,
  reportWaybillException, resolvePrice, reverseEstimate, reverseStatement, runMatchEvidence, scanReceipt,
  settleOutsource, statementDifference, supplierRadar, upgradeFrameAgreement
} from '@/api/purchase-extension'

const tab = ref('supplier')
const supplierId = ref(1)
const qualifications = ref<Array<Record<string, unknown>>>([])
const alerts = ref<Array<Record<string, unknown>>>([])
const radar = ref<Record<string, unknown>>({})
const qualification = reactive({ supplierId: 1, qualificationType: 'ISO9001', certificateNo: '', expireDate: '' })
const bank = reactive({ supplierId: 1, accountName: '', accountNo: '', bankName: '', taxNo: '' })
const inquiry = reactive({ rfqId: 1, lineId: 1, quoteId: 1, supplierId: 1, price: '0', leadDays: 7, score: '80' })
const compare = reactive({ rfqLineId: 1, roundNo: 1, priceWeight: 50, leadWeight: 30, qualityWeight: 20 })
const awards = ref<Array<Record<string, unknown>>>([])
const demand = reactive({ demandIds: '1,2', demandId: 1, supplierId: 1, orderDate: '2026-01-01', unitPrice: '0' })
const order = reactive({ id: 1, changeType: 'DELIVERY', expectedDate: '2026-02-01', remark: '', reason: '客户要求延期' })
const changes = ref<Array<Record<string, unknown>>>([])
const progress = ref<Record<string, unknown>>({})
const arrival = reactive({ productId: 1, planQty: '10', planDate: '2026-02-01' })
const receipt = reactive({ orderId: 1, code: '', qty: '1' })
const diffReceipt = reactive({ id: 1, orderLineId: 1, receiptQty: '1', reason: '到货短少' })
const estimate = reactive({ id: 1, amount: '0', invoiceAmount: '0', reason: '发票与暂估不一致' })
const allocation = reactive({ id: 1, totalAmount: '0', basis: 'QTY' })
const statement = reactive({ id: 1, amount: '0', reason: '金额差异' })
const outsource = reactive({ outsourceId: 1, materialId: 1, standardLossRate: '0.03', reason: '加工损耗', settleAmount: '0' })
const loss = reactive({ id: 1, status: 'APPROVED', reason: '损耗超标' })
const waybill = reactive({ id: 1, nodeName: '到达上海分拨中心', nodeTime: '2026-01-20 10:00:00', location: '上海', reason: '外包装破损', declaredAmount: '0', settledAmount: '0' })
const trackNodes = ref<Record<string, unknown>>({})
const price = reactive({ productId: 1, supplierId: 1, id: 1, status: 'APPROVED' })
const matrix = ref<Array<Record<string, unknown>>>([])
const history = ref<Array<Record<string, unknown>>>([])
const performance = ref<Record<string, unknown>>({})
const portal = reactive({ supplierId: 1, waybillNo: 'SF123', carrierId: 1, freightAmount: '0', invoiceNo: 'INV001', amount: '0' })
const matchForm = reactive({ receiptId: 1, invoiceId: undefined as number | undefined })
const evidenceRows = ref<Array<Record<string, unknown>>>([])
const evidenceSummary = ref<Record<string, unknown>>({})
const frame = reactive({ agreementNo: 'FA-001', supplierId: 1, productId: undefined as number | undefined, startDate: '', endDate: '', totalQty: '100', price: '0', changeReason: '' })
const frameRows = ref<Array<Record<string, unknown>>>([])
const upgradeForm = reactive({ id: 1, startDate: '', endDate: '', totalQty: '', price: '', changeReason: '' })
const blacklist = reactive({ supplierId: 1, supplierName: '', level: 'MEDIUM', reason: '', startDate: '', endDate: '' })
const blacklistRows = ref<Array<Record<string, unknown>>>([])

async function run(fn: () => Promise<unknown>, message: string): Promise<void> {
  try {
    await fn()
    ElMessage.success(message)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
  }
}

async function loadQualifications(): Promise<void> {
  try {
    qualifications.value = await listQualifications(supplierId.value)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  }
}

async function loadEvidence(): Promise<void> {
  try {
    evidenceSummary.value = await runMatchEvidence({ receiptId: matchForm.receiptId, invoiceId: matchForm.invoiceId })
    evidenceRows.value = await listMatchEvidence(matchForm.receiptId)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '生成失败')
  }
}

async function loadFrameAgreements(): Promise<void> {
  try {
    const page = await listFrameAgreements({ page: 1, pageSize: 50 })
    frameRows.value = (page.list ?? []) as Array<Record<string, unknown>>
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  }
}

async function loadBlacklists(): Promise<void> {
  try {
    const page = await listSupplierBlacklists({ page: 1, pageSize: 50 })
    blacklistRows.value = (page.list ?? []) as Array<Record<string, unknown>>
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  }
}

async function loadAlerts(): Promise<void> {
  try {
    alerts.value = await qualificationAlerts()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  }
}

async function loadRadar(): Promise<void> {
  try {
    radar.value = await supplierRadar(supplierId.value)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  }
}

async function loadAwards(): Promise<void> {
  try {
    const result = await listAwards({ page: 1, pageSize: 20 })
    awards.value = (result as { list?: Array<Record<string, unknown>> }).list ?? []
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  }
}

async function loadOrderChanges(): Promise<void> {
  try {
    changes.value = await listOrderChanges(order.id)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  }
}

async function loadProgress(): Promise<void> {
  try {
    progress.value = await orderProgress(order.id)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  }
}

async function loadTrack(): Promise<void> {
  try {
    trackNodes.value = await listTrackNodes(waybill.id)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  }
}

async function loadMatrix(): Promise<void> {
  try {
    matrix.value = await priceMatrix()
    history.value = await priceHistory(price.productId, price.supplierId)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  }
}

async function loadPerformance(): Promise<void> {
  try {
    performance.value = await purchasePerformance()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  }
}
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>采购扩展</h2>
      <p>供应商资质与银行校验、询价多轮比价授标、需求合并转单、订单变更与到货计划、扫码与差异收货、暂估冲销与成本分摊、对账差异与红冲、委外损耗结算、物流轨迹与运费对账、价目表取价与采购绩效。</p>
    </header>

    <el-tabs v-model="tab" type="card">
      <el-tab-pane label="供应商" name="supplier">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="供应商 ID"><el-input-number v-model="supplierId" :min="1" /></el-form-item>
            <el-form-item label="资质类型"><el-input v-model="qualification.qualificationType" /></el-form-item>
            <el-form-item label="证书编号"><el-input v-model="qualification.certificateNo" /></el-form-item>
            <el-form-item label="到期日"><el-date-picker v-model="qualification.expireDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
            <el-form-item label="户名"><el-input v-model="bank.accountName" /></el-form-item>
            <el-form-item label="账号"><el-input v-model="bank.accountNo" /></el-form-item>
            <el-form-item label="开户行"><el-input v-model="bank.bankName" /></el-form-item>
            <el-form-item label="税号"><el-input v-model="bank.taxNo" /></el-form-item>
          </el-form>
          <div class="actions">
            <el-button v-perm="'purchase:supplier:qualification'" @click="run(() => createQualification({ ...qualification, supplierId }), '资质已登记')">登记资质</el-button>
            <el-button v-perm="'purchase:supplier:bank'" @click="run(() => createBankAccount({ ...bank, supplierId }), '银行账户已登记')">登记账户</el-button>
            <el-button @click="loadQualifications">资质列表</el-button>
            <el-button @click="loadAlerts">到期预警</el-button>
            <el-button @click="loadRadar">评级雷达</el-button>
          </div>
          <el-table :data="qualifications" size="small" style="margin-top: 12px">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="qualificationType" label="资质类型" />
            <el-table-column prop="certificateNo" label="证书编号" />
            <el-table-column prop="expireDate" label="到期日" />
            <el-table-column prop="status" label="状态" />
          </el-table>
          <el-table :data="alerts" size="small" style="margin-top: 12px">
            <el-table-column prop="supplierName" label="供应商" />
            <el-table-column prop="qualificationType" label="资质类型" />
            <el-table-column prop="expireDate" label="到期日" />
            <el-table-column prop="level" label="预警级别" />
          </el-table>
          <pre class="json">{{ radar }}</pre>
        </article>
      </el-tab-pane>

      <el-tab-pane label="询价授标" name="inquiry">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="询价单 ID"><el-input-number v-model="inquiry.rfqId" :min="1" /></el-form-item>
            <el-form-item label="询价行 ID"><el-input-number v-model="inquiry.lineId" :min="1" /></el-form-item>
            <el-form-item label="供应商 ID"><el-input-number v-model="inquiry.supplierId" :min="1" /></el-form-item>
            <el-form-item label="报价"><el-input v-model="inquiry.price" /></el-form-item>
            <el-form-item label="交期(天)"><el-input-number v-model="inquiry.leadDays" :min="0" /></el-form-item>
            <el-form-item label="报价行 ID"><el-input-number v-model="compare.rfqLineId" :min="1" /></el-form-item>
            <el-form-item label="轮次"><el-input-number v-model="compare.roundNo" :min="1" /></el-form-item>
            <el-form-item label="授标报价 ID"><el-input-number v-model="inquiry.quoteId" :min="1" /></el-form-item>
          </el-form>
          <div class="actions">
            <el-button v-perm="'purchase:inquiry:update'" @click="run(() => openQuoteRound(inquiry.rfqId), '已开启新一轮')">开启新一轮</el-button>
            <el-button v-perm="'purchase:inquiry:update'" @click="run(() => addRoundQuote(inquiry.lineId, { ...inquiry }), '报价已登记')">登记报价</el-button>
            <el-button type="primary" v-perm="'purchase:inquiry:compare'" @click="run(() => compareQuotes({ ...compare }), '比价完成')">自动比价</el-button>
            <el-button v-perm="'purchase:inquiry:approve'" @click="run(() => createAward({ rfqLineId: inquiry.lineId, quoteId: inquiry.quoteId }), '授标申请已创建')">创建授标</el-button>
            <el-button v-perm="'purchase:inquiry:approve'" @click="run(() => approveAward(inquiry.quoteId, 'APPROVED'), '授标已审批')">审批授标</el-button>
            <el-button @click="loadAwards">授标列表</el-button>
          </div>
          <el-table :data="awards" size="small" style="margin-top: 12px">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="supplierId" label="供应商" />
            <el-table-column prop="roundNo" label="轮次" />
            <el-table-column prop="awardStatus" label="状态" />
          </el-table>
        </article>
      </el-tab-pane>

      <el-tab-pane label="需求与订单" name="order">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="需求 ID 列表"><el-input v-model="demand.demandIds" /></el-form-item>
            <el-form-item label="需求 ID"><el-input-number v-model="demand.demandId" :min="1" /></el-form-item>
            <el-form-item label="供应商 ID"><el-input-number v-model="demand.supplierId" :min="1" /></el-form-item>
            <el-form-item label="下单日期"><el-date-picker v-model="demand.orderDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
            <el-form-item label="订单 ID"><el-input-number v-model="order.id" :min="1" /></el-form-item>
            <el-form-item label="变更类型">
              <el-select v-model="order.changeType">
                <el-option label="交期变更" value="DELIVERY" />
                <el-option label="备注变更" value="REMARK" />
                <el-option label="数量变更" value="QUANTITY" />
                <el-option label="供应商变更" value="SUPPLIER" />
              </el-select>
            </el-form-item>
            <el-form-item label="新交期"><el-date-picker v-model="order.expectedDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
            <el-form-item label="变更原因"><el-input v-model="order.reason" /></el-form-item>
            <el-form-item label="产品 ID"><el-input-number v-model="arrival.productId" :min="1" /></el-form-item>
            <el-form-item label="计划数量"><el-input v-model="arrival.planQty" /></el-form-item>
            <el-form-item label="计划到货日"><el-date-picker v-model="arrival.planDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
          </el-form>
          <div class="actions">
            <el-button v-perm="'purchase:demand:merge'" @click="run(() => mergeDemands(demand.demandIds.split(',').map((v) => Number(v.trim()))), '需求已合并')">合并需求</el-button>
            <el-button v-perm="'purchase:demand:convert'" @click="run(() => convertDemand({ ...demand }), '已转采购订单')">转采购订单</el-button>
            <el-button v-perm="'purchase:order:change'" @click="run(() => changeOrder(order.id, { ...order }), '订单变更已记录')">登记变更</el-button>
            <el-button v-perm="'purchase:order:update'" @click="run(() => createArrivalPlan(order.id, { ...arrival }), '到货计划已创建')">到货计划</el-button>
            <el-button v-perm="'purchase:portal:write'" @click="run(() => confirmOrderByPortal(order.id), '订单已确认')">门户确认</el-button>
            <el-button @click="loadOrderChanges">变更记录</el-button>
            <el-button @click="loadProgress">到货进度</el-button>
          </div>
          <el-table :data="changes" size="small" style="margin-top: 12px">
            <el-table-column prop="version" label="版本" width="80" />
            <el-table-column prop="changeType" label="变更类型" />
            <el-table-column prop="reason" label="原因" />
          </el-table>
          <pre class="json">{{ progress }}</pre>
        </article>
      </el-tab-pane>

      <el-tab-pane label="收货与成本" name="receipt">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="订单 ID"><el-input-number v-model="receipt.orderId" :min="1" /></el-form-item>
            <el-form-item label="条码/序列号"><el-input v-model="receipt.code" /></el-form-item>
            <el-form-item label="数量"><el-input v-model="receipt.qty" /></el-form-item>
            <el-form-item label="收货单 ID"><el-input-number v-model="diffReceipt.id" :min="1" /></el-form-item>
            <el-form-item label="订单行 ID"><el-input-number v-model="diffReceipt.orderLineId" :min="1" /></el-form-item>
            <el-form-item label="实收数量"><el-input v-model="diffReceipt.receiptQty" /></el-form-item>
            <el-form-item label="差异原因"><el-input v-model="diffReceipt.reason" /></el-form-item>
            <el-form-item label="暂估金额"><el-input v-model="estimate.amount" /></el-form-item>
            <el-form-item label="发票金额"><el-input v-model="estimate.invoiceAmount" /></el-form-item>
            <el-form-item label="分摊总额"><el-input v-model="allocation.totalAmount" /></el-form-item>
            <el-form-item label="分摊依据">
              <el-select v-model="allocation.basis">
                <el-option label="数量" value="QTY" />
                <el-option label="金额" value="AMOUNT" />
                <el-option label="重量" value="WEIGHT" />
                <el-option label="均摊" value="EQUAL" />
              </el-select>
            </el-form-item>
          </el-form>
          <div class="actions">
            <el-button v-perm="'purchase:receipt:scan'" @click="run(() => scanReceipt({ ...receipt }), '扫码收货成功')">扫码收货</el-button>
            <el-button v-perm="'purchase:receipt:difference'" @click="run(() => receiveDifference(diffReceipt.id, { ...diffReceipt }), '差异已登记')">差异收货</el-button>
            <el-button v-perm="'purchase:receipt:create'" @click="run(() => createEstimate(estimate.id, estimate.amount), '暂估已登记')">登记暂估</el-button>
            <el-button v-perm="'purchase:estimate:reverse'" @click="run(() => reverseEstimate(estimate.id, { invoiceAmount: estimate.invoiceAmount, reason: estimate.reason }), '暂估已冲销')">暂估冲销</el-button>
            <el-button v-perm="'purchase:cost:allocate'" @click="run(() => allocateCost(allocation.id, { ...allocation }), '成本已分摊')">成本分摊</el-button>
          </div>
        </article>
      </el-tab-pane>

      <el-tab-pane label="对账与委外" name="statement">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="对账单 ID"><el-input-number v-model="statement.id" :min="1" /></el-form-item>
            <el-form-item label="差异/红冲金额"><el-input v-model="statement.amount" /></el-form-item>
            <el-form-item label="原因"><el-input v-model="statement.reason" /></el-form-item>
            <el-form-item label="委外单 ID"><el-input-number v-model="outsource.outsourceId" :min="1" /></el-form-item>
            <el-form-item label="材料 ID"><el-input-number v-model="outsource.materialId" :min="1" /></el-form-item>
            <el-form-item label="标准损耗率"><el-input v-model="outsource.standardLossRate" /></el-form-item>
            <el-form-item label="损耗原因"><el-input v-model="outsource.reason" /></el-form-item>
            <el-form-item label="损耗单 ID"><el-input-number v-model="loss.id" :min="1" /></el-form-item>
            <el-form-item label="结算金额"><el-input v-model="outsource.settleAmount" /></el-form-item>
          </el-form>
          <div class="actions">
            <el-button v-perm="'purchase:statement:difference'" @click="run(() => statementDifference(statement.id), '差异已计算')">对账差异</el-button>
            <el-button v-perm="'purchase:statement:difference'" @click="run(() => markStatementDifference(statement.id, { ...statement }), '差异已标记')">标记差异</el-button>
            <el-button v-perm="'purchase:statement:reverse'" @click="run(() => reverseStatement(statement.id, { ...statement }), '已红冲')">红冲</el-button>
            <el-button v-perm="'purchase:portal:write'" @click="run(() => confirmStatementByPortal(statement.id), '对账单已确认')">门户确认</el-button>
            <el-button v-perm="'purchase:outsource:view'" @click="run(() => createOutsourceLoss({ ...outsource }), '损耗已申报')">申报损耗</el-button>
            <el-button v-perm="'purchase:outsource:approve'" @click="run(() => approveLoss(loss.id, loss.status, loss.reason), '损耗已审批')">审批损耗</el-button>
            <el-button v-perm="'purchase:outsource:settle'" @click="run(() => settleOutsource(outsource.outsourceId, outsource.settleAmount), '结算已生成')">委外结算</el-button>
          </div>
        </article>
      </el-tab-pane>

      <el-tab-pane label="物流" name="logistics">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="运单 ID"><el-input-number v-model="waybill.id" :min="1" /></el-form-item>
            <el-form-item label="节点名称"><el-input v-model="waybill.nodeName" /></el-form-item>
            <el-form-item label="节点时间"><el-date-picker v-model="waybill.nodeTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="YYYY-MM-DD HH:mm:ss"  /></el-form-item>
            <el-form-item label="地点"><el-input v-model="waybill.location" /></el-form-item>
            <el-form-item label="异常原因"><el-input v-model="waybill.reason" /></el-form-item>
            <el-form-item label="申报运费"><el-input v-model="waybill.declaredAmount" /></el-form-item>
            <el-form-item label="结算运费"><el-input v-model="waybill.settledAmount" /></el-form-item>
          </el-form>
          <div class="actions">
            <el-button v-perm="'purchase:logistics:track'" @click="run(() => addTrackNode(waybill.id, { ...waybill }), '轨迹已登记')">登记轨迹</el-button>
            <el-button v-perm="'purchase:logistics:track'" @click="run(() => reportWaybillException(waybill.id, { reason: waybill.reason }), '异常已登记')">异常签收</el-button>
            <el-button v-perm="'purchase:logistics:reconcile'" @click="run(() => reconcileFreight(waybill.id, { declaredAmount: waybill.declaredAmount, settledAmount: waybill.settledAmount }), '运费已对账')">运费对账</el-button>
            <el-button @click="loadTrack">轨迹列表</el-button>
          </div>
          <pre class="json">{{ trackNodes }}</pre>
        </article>
      </el-tab-pane>

      <el-tab-pane label="价目与绩效" name="price">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="产品 ID"><el-input-number v-model="price.productId" :min="1" /></el-form-item>
            <el-form-item label="供应商 ID"><el-input-number v-model="price.supplierId" :min="1" /></el-form-item>
            <el-form-item label="价目价 ID"><el-input-number v-model="price.id" :min="1" /></el-form-item>
            <el-form-item label="门户运单号"><el-input v-model="portal.waybillNo" /></el-form-item>
            <el-form-item label="承运商 ID"><el-input-number v-model="portal.carrierId" :min="1" /></el-form-item>
            <el-form-item label="门户发票号"><el-input v-model="portal.invoiceNo" /></el-form-item>
            <el-form-item label="发票金额"><el-input v-model="portal.amount" /></el-form-item>
          </el-form>
          <div class="actions">
            <el-button v-perm="'purchase:price:view'" @click="run(() => resolvePrice({ productId: price.productId, supplierId: price.supplierId }), '取价完成')">自动取价</el-button>
            <el-button v-perm="'purchase:price:approve'" @click="run(() => approvePrice(price.id, price.status), '价目价已审批')">价目价审批</el-button>
            <el-button v-perm="'purchase:portal:write'" @click="run(() => portalShipment({ ...portal }), '发货通知已登记')">门户发货</el-button>
            <el-button v-perm="'purchase:portal:write'" @click="run(() => portalInvoice({ ...portal }), '发票已登记')">门户发票</el-button>
            <el-button @click="loadMatrix">价目矩阵</el-button>
            <el-button @click="loadPerformance">采购绩效</el-button>
          </div>
          <el-table :data="matrix" size="small" style="margin-top: 12px">
            <el-table-column prop="productCode" label="产品编码" />
            <el-table-column prop="productName" label="产品名称" />
          </el-table>
          <el-table :data="history" size="small" style="margin-top: 12px">
            <el-table-column prop="price" label="价格" />
            <el-table-column prop="sourceType" label="来源" />
            <el-table-column prop="effectiveDate" label="生效日" />
          </el-table>
          <pre class="json">{{ performance }}</pre>
        </article>
      </el-tab-pane>

      <el-tab-pane label="三方匹配证据链" name="evidence">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="收货单 ID"><el-input-number v-model="matchForm.receiptId" :min="1" /></el-form-item>
            <el-form-item label="发票 ID"><el-input-number v-model="matchForm.invoiceId" :min="1" placeholder="可留空" /></el-form-item>
          </el-form>
          <div class="actions">
            <el-button v-perm="'purchase:match:view'" @click="loadEvidence">生成证据链</el-button>
            <el-button v-perm="'purchase:match:view'" @click="loadEvidence">刷新凭证</el-button>
          </div>
          <el-descriptions v-if="evidenceSummary.status" :column="4" border style="margin-top: 12px">
            <el-descriptions-item label="匹配状态">{{ evidenceSummary.status }}</el-descriptions-item>
            <el-descriptions-item label="是否一致">{{ evidenceSummary.matched ? '是' : '否' }}</el-descriptions-item>
            <el-descriptions-item label="异常条目">{{ evidenceSummary.issueCount }}</el-descriptions-item>
            <el-descriptions-item label="凭证条数">{{ evidenceSummary.count }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="evidenceRows" size="small" style="margin-top: 12px">
            <el-table-column prop="receiptNo" label="收货单" width="140" />
            <el-table-column prop="orderNo" label="订单" width="140" />
            <el-table-column prop="invoiceNo" label="发票" width="140" />
            <el-table-column prop="productId" label="产品 ID" width="100" />
            <el-table-column prop="orderQty" label="订单量" width="100" />
            <el-table-column prop="receiptQty" label="收货量" width="100" />
            <el-table-column prop="invoiceQty" label="发票量" width="100" />
            <el-table-column prop="orderPrice" label="订单单价" width="110" />
            <el-table-column prop="invoicePrice" label="发票单价" width="110" />
            <el-table-column prop="status" label="状态" width="120" />
          </el-table>
        </article>
      </el-tab-pane>

      <el-tab-pane label="框架协议" name="frame">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="协议编号"><el-input v-model="frame.agreementNo" /></el-form-item>
            <el-form-item label="供应商 ID"><el-input-number v-model="frame.supplierId" :min="1" /></el-form-item>
            <el-form-item label="产品 ID"><el-input-number v-model="frame.productId" :min="1" placeholder="可留空" /></el-form-item>
            <el-form-item label="生效日"><el-date-picker v-model="frame.startDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
            <el-form-item label="失效日"><el-date-picker v-model="frame.endDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
            <el-form-item label="协议总量"><el-input v-model="frame.totalQty" /></el-form-item>
            <el-form-item label="协议单价"><el-input v-model="frame.price" /></el-form-item>
            <el-form-item label="变更原因"><el-input v-model="frame.changeReason" /></el-form-item>
          </el-form>
          <div class="actions">
            <el-button v-perm="'purchase:frame:view'" @click="run(() => createFrameAgreement({ ...frame }), '框架协议已建档')">建档</el-button>
            <el-button @click="loadFrameAgreements">刷新列表</el-button>
          </div>

          <el-form label-width="110px" style="margin-top: 16px">
            <el-form-item label="协议 ID"><el-input-number v-model="upgradeForm.id" :min="1" /></el-form-item>
            <el-form-item label="生效日"><el-date-picker v-model="upgradeForm.startDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
            <el-form-item label="失效日"><el-date-picker v-model="upgradeForm.endDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
            <el-form-item label="协议总量"><el-input v-model="upgradeForm.totalQty" placeholder="留空继承" /></el-form-item>
            <el-form-item label="协议单价"><el-input v-model="upgradeForm.price" placeholder="留空继承" /></el-form-item>
            <el-form-item label="变更原因"><el-input v-model="upgradeForm.changeReason" /></el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'purchase:frame:view'" @click="run(() => upgradeFrameAgreement(upgradeForm.id, { ...upgradeForm }), '协议已升版')">升版</el-button>

          <el-table :data="frameRows" size="small" style="margin-top: 12px">
            <el-table-column prop="agreementNo" label="协议编号" width="150" />
            <el-table-column prop="supplierId" label="供应商 ID" width="110" />
            <el-table-column prop="version" label="版本" width="80" />
            <el-table-column prop="totalQty" label="总量" width="110" />
            <el-table-column prop="usedQty" label="已用量" width="110" />
            <el-table-column prop="price" label="单价" width="110" />
            <el-table-column prop="startDate" label="生效日" width="120" />
            <el-table-column prop="endDate" label="失效日" width="120" />
            <el-table-column prop="status" label="状态" width="120" />
          </el-table>
        </article>
      </el-tab-pane>

      <el-tab-pane label="供应商黑名单" name="blacklist">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="供应商 ID"><el-input-number v-model="blacklist.supplierId" :min="1" /></el-form-item>
            <el-form-item label="供应商名称"><el-input v-model="blacklist.supplierName" /></el-form-item>
            <el-form-item label="级别">
              <el-select v-model="blacklist.level">
                <el-option label="低" value="LOW" />
                <el-option label="中" value="MEDIUM" />
                <el-option label="高" value="HIGH" />
              </el-select>
            </el-form-item>
            <el-form-item label="原因"><el-input v-model="blacklist.reason" /></el-form-item>
            <el-form-item label="生效日"><el-date-picker v-model="blacklist.startDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
            <el-form-item label="解禁日"><el-date-picker v-model="blacklist.endDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
          </el-form>
          <div class="actions">
            <el-button type="danger" v-perm="'purchase:blacklist:view'" @click="run(() => addSupplierBlacklist({ ...blacklist }), '已加入黑名单')">加入黑名单</el-button>
            <el-button v-perm="'purchase:blacklist:view'" @click="run(() => checkSupplierBlacklist(blacklist.supplierId), '准入校验完成')">准入校验</el-button>
            <el-button v-perm="'purchase:blacklist:view'" @click="run(() => liftSupplierBlacklist(blacklist.supplierId), '已解除黑名单')">解除黑名单</el-button>
            <el-button @click="loadBlacklists">刷新列表</el-button>
          </div>
          <el-table :data="blacklistRows" size="small" style="margin-top: 12px">
            <el-table-column prop="supplierId" label="供应商 ID" width="110" />
            <el-table-column prop="supplierName" label="供应商" min-width="150" />
            <el-table-column prop="level" label="级别" width="90" />
            <el-table-column prop="reason" label="原因" min-width="180" />
            <el-table-column prop="startDate" label="生效日" width="120" />
            <el-table-column prop="endDate" label="解禁日" width="120" />
            <el-table-column prop="status" label="状态" width="100" />
          </el-table>
        </article>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.form-panel { max-width: 640px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.json { margin-top: 12px; padding: 8px; background: #f6f8fa; border-radius: 6px; font-size: 12px; max-height: 240px; overflow: auto; }
</style>
