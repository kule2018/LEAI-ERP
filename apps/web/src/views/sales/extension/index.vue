<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  advanceOpportunity, approveCustomerMerge, approveQuotation, compareQuotationVersions,
  convertQuotation, createCustomerMerge, createCrmContact, createRedInvoice,
  duplicateLeads, fetchCustomerProfile360, fetchMemberPrice, fetchTargetAlerts,
  handleChurnWarning, hangPosOrder, posPay, refreshTarget, resumePosHang,
  saveQuotationVersion, scanChurnWarnings, setMemberPrice, smartAssignLead
} from '@/api/sales-extension'

const tab = ref('lead')
const leadId = ref(0)
const duplicates = ref<Array<Record<string, unknown>>>([])
const opp = reactive({ id: 0, stage: 'QUALIFIED', expectedAmount: '0', closeDate: '', competitor: '' })
const quoteId = ref(0)
const merge = reactive({ id: 0, fromCustomerId: 0, toCustomerId: 0, reason: '' })
const pos = reactive({ id: 0, hangKey: '', customerId: 0, payload: '{"lines":[{"productId":1,"qty":"1","unitPrice":"10"}]}' })
const targetId = ref(0)

const profileId = ref(0)
const profile = ref<Record<string, unknown> | null>(null)
const contactForm = reactive({ customerId: 0, contactName: '', contactRole: '', phone: '', email: '', isPrimary: 0 })
const churnRows = ref<Array<Record<string, unknown>>>([])
const versionForm = reactive({ id: 0, baseVersion: undefined as number | undefined, changeReason: '' })
const versionDiff = ref<Record<string, unknown> | null>(null)
const payment = reactive({
  orderId: 0,
  payments: [{ payType: 'CASH', amount: '0', tradeNo: '' }]
})
const paymentResult = ref<Record<string, unknown> | null>(null)
const member = reactive({ customerId: 0, productId: 0, memberLevel: 'NORMAL', price: '0' })
const memberPrice = ref<Record<string, unknown> | null>(null)
const redInvoice = reactive({ returnId: undefined as number | undefined, originInvoiceNo: '', amount: '0', taxAmount: '0', reason: '' })
const redInvoiceResult = ref<Record<string, unknown> | null>(null)
const targetAlerts = ref<Array<Record<string, unknown>>>([])

async function run(fn: () => Promise<unknown>, message: string): Promise<void> {
  try {
    await fn()
    ElMessage.success(message)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
  }
}

async function findDuplicates(): Promise<void> {
  try {
    duplicates.value = await duplicateLeads(leadId.value)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '检测失败')
  }
}

async function loadProfile(): Promise<void> {
  try {
    profile.value = await fetchCustomerProfile360(profileId.value)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  }
}

async function loadChurn(): Promise<void> {
  try {
    churnRows.value = await scanChurnWarnings()
    ElMessage.success(`已生成 ${churnRows.value.length} 条预警`)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '扫描失败')
  }
}

async function compareVersions(): Promise<void> {
  try {
    versionDiff.value = await compareQuotationVersions(versionForm.id, versionForm.baseVersion)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '对比失败')
  }
}

async function queryMemberPrice(): Promise<void> {
  try {
    memberPrice.value = await fetchMemberPrice(member.customerId, member.productId)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '取价失败')
  }
}

async function loadTargetAlerts(): Promise<void> {
  try {
    targetAlerts.value = await fetchTargetAlerts()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载失败')
  }
}

function addPaymentRow(): void {
  payment.payments.push({ payType: 'CASH', amount: '0', tradeNo: '' })
}

function removePaymentRow(index: number): void {
  if (payment.payments.length <= 1) return
  payment.payments.splice(index, 1)
}

function riskTag(level: unknown): string {
  if (level === 'HIGH') return 'danger'
  if (level === 'MEDIUM') return 'warning'
  return 'info'
}
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>销售扩展</h2>
      <p>线索评分去重、商机阶段门禁、报价审批转单、客户合并审批、POS 挂单与目标刷新；客户 360 图谱、流失预警、报价版本对比、POS 多支付与会员价、退货红字发票、销售目标预警。</p>
    </header>

    <el-tabs v-model="tab" type="card">
      <el-tab-pane label="线索" name="lead">
        <article class="panel form-panel">
          <el-form label-width="100px">
            <el-form-item label="线索 ID"><el-input-number v-model="leadId" :min="1" /></el-form-item>
          </el-form>
          <el-button v-perm="'sales:lead:update'" @click="run(() => smartAssignLead(leadId), '评分与分配完成')">智能评分分配</el-button>
          <el-button @click="findDuplicates">重复检测</el-button>
          <el-table :data="duplicates" size="small" style="margin-top: 12px">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="name" label="姓名" />
            <el-table-column prop="phone" label="手机" />
          </el-table>
        </article>
      </el-tab-pane>

      <el-tab-pane label="商机" name="opportunity">
        <article class="panel form-panel">
          <el-form label-width="100px">
            <el-form-item label="商机 ID"><el-input-number v-model="opp.id" :min="1" /></el-form-item>
            <el-form-item label="阶段">
              <el-select v-model="opp.stage">
                <el-option label="资格确认" value="QUALIFIED" />
                <el-option label="方案" value="PROPOSAL" />
                <el-option label="谈判" value="NEGOTIATION" />
                <el-option label="赢单" value="WON" />
              </el-select>
            </el-form-item>
            <el-form-item label="预计金额"><el-input v-model="opp.expectedAmount" /></el-form-item>
            <el-form-item label="预计成交日"><el-date-picker v-model="opp.closeDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
            <el-form-item label="竞品"><el-input v-model="opp.competitor" /></el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'sales:opportunity:update'" @click="run(() => advanceOpportunity(opp.id, { ...opp }), '阶段已推进')">推进阶段</el-button>
        </article>
      </el-tab-pane>

      <el-tab-pane label="报价" name="quotation">
        <article class="panel form-panel">
          <el-form label-width="100px">
            <el-form-item label="报价 ID"><el-input-number v-model="quoteId" :min="1" /></el-form-item>
          </el-form>
          <el-button v-perm="'sales:quotation:update'" @click="run(() => approveQuotation(quoteId, 'APPROVED'), '报价已审批')">审批</el-button>
          <el-button type="primary" v-perm="'sales:quotation:convert'" @click="run(() => convertQuotation(quoteId), '已转销售单')">转销售单</el-button>
        </article>
      </el-tab-pane>

      <el-tab-pane label="客户合并" name="merge">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="源客户 ID"><el-input-number v-model="merge.fromCustomerId" :min="1" /></el-form-item>
            <el-form-item label="目标客户 ID"><el-input-number v-model="merge.toCustomerId" :min="1" /></el-form-item>
            <el-form-item label="原因"><el-input v-model="merge.reason" /></el-form-item>
            <el-form-item label="申请 ID"><el-input-number v-model="merge.id" :min="0" /></el-form-item>
          </el-form>
          <el-button v-perm="'sales:customer:merge'" @click="run(() => createCustomerMerge({ ...merge }), '合并申请已提交')">提交申请</el-button>
          <el-button type="primary" v-perm="'sales:customer:merge'" @click="run(() => approveCustomerMerge(merge.id, 'APPROVED'), '合并已审批')">审批</el-button>
        </article>
      </el-tab-pane>

      <el-tab-pane label="POS 挂单" name="pos">
        <article class="panel form-panel">
          <el-form label-width="100px">
            <el-form-item label="挂单键"><el-input v-model="pos.hangKey" /></el-form-item>
            <el-form-item label="客户 ID"><el-input-number v-model="pos.customerId" :min="0" /></el-form-item>
            <el-form-item label="明细 JSON"><el-input v-model="pos.payload" type="textarea" :rows="4" /></el-form-item>
            <el-form-item label="挂单 ID"><el-input-number v-model="pos.id" :min="0" /></el-form-item>
          </el-form>
          <el-button v-perm="'sales:pos:hang'" @click="run(() => hangPosOrder({ ...pos }), '已挂单')">挂单</el-button>
          <el-button type="primary" v-perm="'sales:pos:hang'" @click="run(() => resumePosHang(pos.id), '已恢复销售单')">恢复</el-button>
        </article>
      </el-tab-pane>

      <el-tab-pane label="目标" name="target">
        <article class="panel form-panel">
          <el-form label-width="100px">
            <el-form-item label="目标 ID"><el-input-number v-model="targetId" :min="1" /></el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'sales:target:update'" @click="run(() => refreshTarget(targetId), '实际额已刷新')">刷新实际额</el-button>
          <el-button v-perm="'sales:target:view'" @click="loadTargetAlerts">加载达成预警</el-button>
          <el-table v-if="targetAlerts.length" :data="targetAlerts" size="small" style="margin-top: 12px">
            <el-table-column prop="period" label="期间" width="110" />
            <el-table-column prop="targetAmount" label="目标额" width="120" />
            <el-table-column prop="actualAmount" label="实际额" width="120" />
            <el-table-column prop="rate" label="达成率(%)" width="110" />
            <el-table-column prop="level" label="级别" width="100" />
            <el-table-column prop="message" label="提示" min-width="180" />
          </el-table>
        </article>
      </el-tab-pane>

      <el-tab-pane label="客户 360" name="profile">
        <article class="panel form-panel">
          <el-form label-width="100px">
            <el-form-item label="客户 ID"><el-input-number v-model="profileId" :min="1" /></el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'sales:customer:profile'" @click="loadProfile">加载画像</el-button>

          <el-descriptions v-if="profile" :column="3" border style="margin-top: 16px">
            <el-descriptions-item label="客户等级">{{ (profile.profile as Record<string, unknown>)?.level ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="订单数">{{ (profile.profile as Record<string, unknown>)?.orderCount ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="累计金额">{{ (profile.profile as Record<string, unknown>)?.totalAmount ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="客单价">{{ (profile.profile as Record<string, unknown>)?.avgAmount ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="最近成交">{{ (profile.profile as Record<string, unknown>)?.lastOrderDate ?? '无' }}</el-descriptions-item>
            <el-descriptions-item label="距今天数">{{ (profile.profile as Record<string, unknown>)?.daysSinceLastOrder ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="逾期应收">{{ (profile.profile as Record<string, unknown>)?.overdueAmount ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="跟进次数">{{ (profile.profile as Record<string, unknown>)?.followCount ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="流失风险">
              <el-tag :type="riskTag((profile.risk as Record<string, unknown>)?.level)">{{ (profile.risk as Record<string, unknown>)?.level ?? '-' }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>

          <el-table v-if="profile" :data="(profile.contacts as Array<Record<string, unknown>>) ?? []" size="small" style="margin-top: 12px">
            <el-table-column prop="contactName" label="联系人" width="120" />
            <el-table-column prop="contactRole" label="职务" width="120" />
            <el-table-column prop="phone" label="电话" width="140" />
            <el-table-column prop="email" label="邮箱" min-width="180" />
          </el-table>

          <el-form label-width="100px" style="margin-top: 16px">
            <el-form-item label="客户 ID"><el-input-number v-model="contactForm.customerId" :min="1" /></el-form-item>
            <el-form-item label="联系人"><el-input v-model="contactForm.contactName" /></el-form-item>
            <el-form-item label="职务"><el-input v-model="contactForm.contactRole" /></el-form-item>
            <el-form-item label="电话"><el-input v-model="contactForm.phone" /></el-form-item>
            <el-form-item label="邮箱"><el-input v-model="contactForm.email" /></el-form-item>
            <el-form-item label="主要联系人">
              <el-switch v-model="contactForm.isPrimary" :active-value="1" :inactive-value="0" />
            </el-form-item>
          </el-form>
          <el-button v-perm="'sales:customer:update'" @click="run(() => createCrmContact({ ...contactForm }), '联系人已新增')">新增联系人</el-button>
        </article>
      </el-tab-pane>

      <el-tab-pane label="流失预警" name="churn">
        <article class="panel">
          <el-button type="primary" v-perm="'sales:churn:view'" @click="loadChurn">扫描流失预警</el-button>
          <el-table :data="churnRows" size="small" style="margin-top: 12px">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="customerId" label="客户 ID" width="100" />
            <el-table-column prop="customerName" label="客户" min-width="150" />
            <el-table-column prop="level" label="风险等级" width="110">
              <template #default="{ row }"><el-tag :type="riskTag(row.level)">{{ row.level }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="score" label="评分" width="90" />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button size="small" v-perm="'sales:churn:handle'" @click="run(() => handleChurnWarning(row.id, 'HANDLED'), '预警已处理')">处理</el-button>
                <el-button size="small" v-perm="'sales:churn:handle'" @click="run(() => handleChurnWarning(row.id, 'IGNORED'), '预警已忽略')">忽略</el-button>
              </template>
            </el-table-column>
          </el-table>
        </article>
      </el-tab-pane>

      <el-tab-pane label="报价版本" name="version">
        <article class="panel form-panel">
          <el-form label-width="100px">
            <el-form-item label="报价 ID"><el-input-number v-model="versionForm.id" :min="1" /></el-form-item>
            <el-form-item label="基线版本"><el-input-number v-model="versionForm.baseVersion" :min="1" placeholder="默认最新快照" /></el-form-item>
            <el-form-item label="变更原因"><el-input v-model="versionForm.changeReason" /></el-form-item>
          </el-form>
          <el-button v-perm="'sales:quotation:version'" @click="run(() => saveQuotationVersion(versionForm.id, versionForm.changeReason), '版本快照已保存')">保存快照</el-button>
          <el-button type="primary" v-perm="'sales:quotation:version'" @click="compareVersions">版本对比</el-button>

          <el-descriptions v-if="versionDiff" :column="2" border style="margin-top: 16px">
            <el-descriptions-item label="基线版本">{{ versionDiff.baseVersion }}</el-descriptions-item>
            <el-descriptions-item label="当前版本">{{ versionDiff.currentVersion }}</el-descriptions-item>
            <el-descriptions-item label="基线金额">{{ (versionDiff.diff as Record<string, unknown>)?.totalBefore ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="当前金额">{{ (versionDiff.diff as Record<string, unknown>)?.totalAfter ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="差额">{{ (versionDiff.diff as Record<string, unknown>)?.totalDiff ?? 0 }}</el-descriptions-item>
          </el-descriptions>
          <el-table
            v-if="versionDiff"
            :data="((versionDiff.diff as Record<string, unknown>)?.changed as Array<Record<string, unknown>>) ?? []"
            size="small"
            style="margin-top: 12px"
          >
            <el-table-column prop="productId" label="产品 ID" width="110" />
            <el-table-column prop="field" label="变更字段" width="110" />
            <el-table-column prop="before" label="变更前" width="110" />
            <el-table-column prop="after" label="变更后" width="110" />
          </el-table>
        </article>
      </el-tab-pane>

      <el-tab-pane label="POS 多支付" name="payment">
        <article class="panel form-panel">
          <el-form label-width="100px">
            <el-form-item label="销售单 ID"><el-input-number v-model="payment.orderId" :min="1" /></el-form-item>
          </el-form>
          <el-table :data="payment.payments" size="small">
            <el-table-column label="支付方式" width="160">
              <template #default="{ row }">
                <el-select v-model="row.payType">
                  <el-option label="现金" value="CASH" />
                  <el-option label="微信" value="WECHAT" />
                  <el-option label="支付宝" value="ALIPAY" />
                  <el-option label="银行卡" value="CARD" />
                  <el-option label="挂账" value="CREDIT" />
                  <el-option label="其他" value="OTHER" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="金额" width="160">
              <template #default="{ row }"><el-input v-model="row.amount" /></template>
            </el-table-column>
            <el-table-column label="交易号" min-width="160">
              <template #default="{ row }"><el-input v-model="row.tradeNo" /></template>
            </el-table-column>
            <el-table-column label="操作" width="90">
              <template #default="{ $index }"><el-button size="small" @click="removePaymentRow($index)">删除</el-button></template>
            </el-table-column>
          </el-table>
          <el-button style="margin-top: 8px" @click="addPaymentRow">添加支付行</el-button>
          <el-button type="primary" v-perm="'sales:pos:pay'" @click="run(async () => { paymentResult = await posPay({ ...payment }) }, '支付已登记')">确认支付</el-button>

          <el-descriptions v-if="paymentResult" :column="2" border style="margin-top: 16px">
            <el-descriptions-item label="销售单 ID">{{ paymentResult.orderId }}</el-descriptions-item>
            <el-descriptions-item label="已付金额">
              {{ (paymentResult.split as Record<string, unknown>)?.paidAmount ?? 0 }}
            </el-descriptions-item>
          </el-descriptions>
        </article>
      </el-tab-pane>

      <el-tab-pane label="会员价" name="member">
        <article class="panel form-panel">
          <el-form label-width="100px">
            <el-form-item label="客户 ID"><el-input-number v-model="member.customerId" :min="1" /></el-form-item>
            <el-form-item label="产品 ID"><el-input-number v-model="member.productId" :min="1" /></el-form-item>
            <el-form-item label="会员等级">
              <el-select v-model="member.memberLevel">
                <el-option label="普通" value="NORMAL" />
                <el-option label="银卡" value="SILVER" />
                <el-option label="金卡" value="GOLD" />
                <el-option label="钻石" value="DIAMOND" />
              </el-select>
            </el-form-item>
            <el-form-item label="会员价"><el-input v-model="member.price" /></el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'sales:pos:member-price'" @click="run(() => setMemberPrice({ ...member }), '会员价已设置')">设置会员价</el-button>
          <el-button v-perm="'sales:pos:member-price'" @click="queryMemberPrice">查询成交价</el-button>
          <el-descriptions v-if="memberPrice" :column="3" border style="margin-top: 16px">
            <el-descriptions-item label="原价">{{ memberPrice.basePrice }}</el-descriptions-item>
            <el-descriptions-item label="会员价">{{ memberPrice.memberPrice ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="成交价">{{ memberPrice.finalPrice }}</el-descriptions-item>
          </el-descriptions>
        </article>
      </el-tab-pane>

      <el-tab-pane label="红字发票" name="red-invoice">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="退货单 ID"><el-input-number v-model="redInvoice.returnId" :min="1" /></el-form-item>
            <el-form-item label="原发票号"><el-input v-model="redInvoice.originInvoiceNo" /></el-form-item>
            <el-form-item label="冲红金额"><el-input v-model="redInvoice.amount" /></el-form-item>
            <el-form-item label="税额"><el-input v-model="redInvoice.taxAmount" /></el-form-item>
            <el-form-item label="原因"><el-input v-model="redInvoice.reason" /></el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'sales:return:red-invoice'" @click="run(async () => { redInvoiceResult = await createRedInvoice({ ...redInvoice }) }, '红字发票已生成')">生成红字发票</el-button>
          <el-descriptions v-if="redInvoiceResult" :column="2" border style="margin-top: 16px">
            <el-descriptions-item label="发票号">{{ redInvoiceResult.invoiceNo }}</el-descriptions-item>
            <el-descriptions-item label="类型">{{ redInvoiceResult.invoiceType }}</el-descriptions-item>
            <el-descriptions-item label="金额">{{ redInvoiceResult.amount }}</el-descriptions-item>
            <el-descriptions-item label="税额">{{ redInvoiceResult.taxAmount }}</el-descriptions-item>
          </el-descriptions>
        </article>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.form-panel { max-width: 720px; }
</style>
